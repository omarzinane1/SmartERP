# E-mails métier — configuration et scénarios

Le suivi est dans `notifications.BusinessEmail`. Les anciens champs de livraison de Notification et InvoiceReminder sont conservés comme projections de ce suivi ; la migration 0003 reprend leur historique sans déclencher d'envoi.

## Configuration

L'activation est explicite et doit être identique dans Django et le worker :

```powershell
$env:DJANGO_SETTINGS_MODULE = 'config.settings.development'
$env:EMAIL_DELIVERY_ENABLED = 'true'
$env:EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
$env:DEFAULT_FROM_EMAIL = 'noreply@smarterp.local'
.\.venv\Scripts\celery.exe -A config worker -l info --pool=solo
```

Le backend console est le défaut de développement ; l'envoi reste désactivé par défaut. La console produit un vrai message MIME local, sans SMTP. Le statut `sent` y signifie accepté par ce backend de développement ; `backend` conserve cette distinction et l'interface affiche « Accepté par la console locale ». Aucun accusé de réception de boîte distante n'est déduit d'un succès SMTP non plus.

Pour un transport SMTP de production, configurer par environnement `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, `EMAIL_USE_SSL`, `DEFAULT_FROM_EMAIL` et `EMAIL_DELIVERY_ENABLED=true`. Ne pas activer TLS et SSL simultanément. Les credentials ne sont jamais stockés dans BusinessEmail ni dans les métadonnées d'audit. Le nom affiché de l'expéditeur vient de `company.legal_name` ou `company.name` ; l'adresse technique vient de l'environnement.

Les tests utilisent seulement `django.core.mail.backends.locmem.EmailBackend`, avec activation explicite dans leurs fixtures. Les backends dummy/file non configurés comme transport pris en charge ne simulent pas de succès.

## Contrats métier

| Action | Endpoint / service | Destinataire / règle |
| --- | --- | --- |
| Envoyer facture | POST /api/invoices/ID/send/ | Client actuel ; facture comptabilisée ; invoices.send et invoices.view |
| Relancer facture | POST /api/invoices/ID/remind/ | Client actuel ; solde positif, échéance passée ; invoices.remind |
| Envoyer devis | POST /api/quotes/ID/send/ | Client ; transition officielle draft → sent ; quotes.send et quotes.view |
| Envoyer commande fournisseur | POST /api/purchase-orders/ID/send/ | Fournisseur actif ; transition officielle ; purchases.edit et purchases.view |
| Confirmer paiement | create_payment, après création et affectation | Client d'un paiement entrant confirmé ; erreur d'adresse secondaire, sans annuler le paiement |
| Demander approbation | _new_request | Membres actifs autorisés à lire ET décider la demande ; pas d'assignation nominative dans le domaine actuel |
| Accepter/refuser approbation | _decide | Demandeur s'il conserve les droits de lecture ; notification unique |
| Notification générique | create_notification | Destinataire de la Notification persistante, sous ses droits actuels |

Les requêtes manuelles refusent une adresse absente/invalide avant mise en file (400). Un manque de permission donne 403 ; une entité étrangère 404 ; un état métier incompatible 409. Les endpoints existants conservent HTTP 200 et leur réponse document ; les tâches font le réseau après commit. Le statut commercial « envoyé » d'un devis/bon de commande reste celui du workflow officiel et ne prouve pas la livraison de l'e-mail.

`Idempotency-Key` protège les reprises réseau. Un envoi initial d'un même document réutilise son BusinessEmail, même avec une autre clé. Pour un **renvoi intentionnel**, utiliser le même endpoint avec `{ "resend": true }` et une nouvelle clé ; rejouer cette même clé ne produit qu'un seul renvoi. La relance facture reste une action distincte, protégée par sa clé d'opération existante. Les boutons sont bloqués pendant la requête ; le panneau E-mails fournit la confirmation explicite du renvoi.

Consulter `GET /api/business-emails/?entity_type=invoice&entity_id=123`. Types : invoice, quote, purchaseorder, payment, approval. Société et droits de lecture réévalués ; pour les approbations, seul le destinataire lit les métadonnées de son e-mail. Les corps, pièces jointes et jetons de claim ne sont pas exposés.

## Cycle de livraison

`pending → sending → sent`. Les erreurs temporaires sûres passent par `retrying`, avec au plus 3 reprises et 4 tentatives. Une erreur permanente donne `failed`. La désactivation ou un événement devenu invalide peut donner `skipped`. Une coupure après soumission SMTP ou un worker interrompu donne `uncertain` : vérifier avant de renvoyer.

La task recharge les objets, adresses, droits, société et état. Le message est multipart texte/HTML, avec PDF facture/devis via `commercial_pdf_data(..., purpose="email")` puis `render_commercial_pdf`. Les corps HTML sont échappés ; les en-têtes dynamiques sont nettoyés. Aucun upload arbitraire n'est joint. Aucun PDF commande fournisseur n'est fabriqué : ce moteur n'existe pas encore.

Les états sending dépassant 15 minutes deviennent incertains, les attentes/reprises dépassant 24 heures deviennent échouées. La maintenance Beat et la consultation de l'historique rapprochent ces états. Voir [les horaires](ASYNC_TASKS.md).

## Scénarios manuels

**A — Facture.** Démarrer Valkey, Django et le worker avec les variables console ci-dessus. Ouvrir une facture comptabilisée dont le client possède une adresse valide, avec invoices.view/send. Cliquer Envoyer puis confirmer. Vérifier l'API 200, un BusinessEmail pending, received/succeeded côté worker, le MIME texte+HTML+PDF dans la console et le suivi « Accepté par la console locale ». Cliquer Renvoyer le document et confirmer pour un second envoi volontaire.

**B — Retard.** Ouvrir une facture comptabilisée avec une échéance passée et un reste dû positif. Cliquer Relancer. Vérifier InvoiceReminder et son BusinessEmail lié, le montant réel, l'échéance et l'adresse actuelle. Après règlement intégral, une nouvelle relance doit être refusée ; une relance déjà en file doit être ignorée par le worker si la facture n'est plus éligible.

**C — Devis.** Ouvrir un devis brouillon non expiré avec client renseigné. Envoyer, vérifier la transition officielle et l'historique séparé de livraison. Le message doit contenir le numéro, la validité, le montant et le PDF. Un client sans adresse doit laisser le devis en brouillon après le refus 400.

**D — Approbation.** Soumettre une dépense. Un membre autorisé à lire et décider les dépenses reçoit une Notification et un e-mail de demande. Accepter ou refuser avec ce membre : le demandeur autorisé reçoit une confirmation. Rejouer la décision ne doit créer aucun nouvel e-mail. Une demande devenue décidée avant l'exécution de son e-mail initial ne doit plus envoyer une invitation à décider.

**E — Erreur contrôlée.** Sans modifier le SMTP réel, exécuter `python manage.py test apps.notifications.tests.test_business_emails.BusinessEmailTests.test_temporary_smtp_retries_are_bounded_and_terminal_failure_audited --settings=config.settings.test`. Le backend est simulé en erreur 451 : trois reprises, quatre tentatives, failed_at renseigné, sent_at absent, audit email.failed. Le test de déconnexion ambiguë vérifie uncertain et l'absence de renvoi automatique.

## Vérification réelle, sans SMTP externe

```powershell
.\.venv\Scripts\python.exe scripts\check_business_email_worker.py
```

Le script force console dans son processus et son worker enfant, exige un broker local réel, crée une société/utilisateur/client/facture de validation avec adresses `.test`, prépare et exécute l'e-mail sur sa propre file. Il vérifie received/succeeded, BusinessEmail, l'horodatage et les parties MIME texte/HTML/PDF. Il arrête son worker et supprime uniquement ses propres enregistrements de validation. Le corps MIME n'est pas recopié dans le rapport. Valkey est laissé actif.

## Limites retenues

Pas de tracking, marketing, IMAP, SMTP propre à chaque société, lien public signé ou moteur de préférences. Les templates sont français. Pas de PDF achat, pas de lien d'action tant qu'une URL frontend sûre n'est pas configurée. Les relances ne sont pas programmées automatiquement vers les clients : le scan crée des alertes internes. La livraison distante et l'unicité absolue après coupure SMTP ne peuvent pas être garanties par SMTP seul. Les clés de requête expirent après 30 jours ; les déduplications d'événement dans BusinessEmail restent durables.
