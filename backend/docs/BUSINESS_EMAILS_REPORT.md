# SmartERP AI — rapport e-mails métier

8 octobre 2026. Frontend réel : `smarterp-ai/`. Socle asynchrone présent dans le commit `3412be5` ; aucun commit ni push effectué par cet agent. Audit préalable : [BUSINESS_EMAILS_AUDIT.md](BUSINESS_EMAILS_AUDIT.md). Configuration et scénarios A–E : [BUSINESS_EMAILS.md](BUSINESS_EMAILS.md).

## 1 — Status

| Fonction | État | Résultat |
| --- | --- | --- |
| Invoice Email | DONE | Action send, adresse validée, HTML/texte, PDF existant, suivi et renvoi explicite |
| Invoice Reminder | DONE | Workflow existant conservé ; éligibilité relue ; BusinessEmail lié à InvoiceReminder |
| Quote Email | DONE | Endpoint et transition officiels réutilisés ; PDF et état de livraison séparé |
| Purchase Order Email | DONE | Fournisseur actuel, HTML/texte ; PDF non joint car moteur achat absent |
| Payment Confirmation | DONE | Après création/affectation d'un paiement entrant, sans mutation financière dans la task |
| Approval Requested | DONE | Membres actifs autorisés à lire et décider le type de demande |
| Approval Decision | DONE | Templates approved/rejected au demandeur autorisé, notification unique |
| Generic Notification Email | DONE | Signature existante réutilisée, aucune notification supplémentaire depuis la task |

## 2 — Files

Inventaire exact Created/Modified/Deleted : [BUSINESS_EMAILS_FILES.md](BUSINESS_EMAILS_FILES.md).

Créations principales : `notifications/email_builders.py`, `email_services.py`, `email_views.py`, `serializers.py`, migrations `0002_businessemail` et `0003_backfill_email_history`, tests métier, vingt templates HTML/TXT avec leurs bases, panneau frontend `BusinessEmailPanel`, test navigateur et script de vérification réelle.

Modifications principales : transport central `common/email_delivery.py`, settings Django, services et vues Sales/Purchasing/Finance/Approvals, services de notification et d'audit, sélecteur PDF existant, actions frontend et messages de confirmation. Les tests historiques de route facture et de double envoi achat ont été adaptés au nouveau contrat ; leurs assertions RBAC et d'immutabilité sont conservées.

Aucun fichier suivi supprimé. Aucune dépendance ajoutée. Aucune migration appliquée réécrite.

## 3 — Model

`notifications.BusinessEmail` : société, type d'e-mail, type/ID d'entité, demandeur éventuel, utilisateur destinataire éventuel, snapshots `recipient` et `subject`, clé de déduplication, liens uniques facultatifs vers Notification/InvoiceReminder, backend réellement utilisé, création, échec, erreur contrôlée. L'état commun ajoute `email_attempts`, `email_started_at`, `email_sent_at`, `email_error_code` et `email_claim`.

États : pending, sending, retrying, sent, failed, skipped, uncertain. Aucun sent_at avant acceptation positive du backend. `retryCount` exposé = nombre de tentatives au-delà de la première.

Contraintes : unicité société/événement, statut valide, horodatage obligatoire si sent, liens OneToOne vers les objets historiques. Index : société/type d'entité/ID/date ; statut/début d'envoi. Les identités d'événements restent protégées même après expiration d'une clé du registre d'idempotence.

Migration 0003 : reprise des états historiques, sans publication de task ni envoi. Un ancien état sent sans preuve temporelle devient uncertain ; aucun horodatage de succès n'est inventé. Les champs historiques restent des projections compatibles, le claim d'envoi est désormais porté par BusinessEmail.

## 4 — Email templates

Sous `backend/templates/emails/`, chaque ligne possède **`.html` et `.txt`** :

| Paire de templates | Usage |
| --- | --- |
| base | Identité de la société, coordonnées et footer |
| invoices/invoice_sent | Facture, total, échéance et solde |
| invoices/overdue_reminder | Relance et reste dû |
| quotes/quote_sent | Devis, validité et montant |
| purchases/purchase_order_sent | Commande, livraison attendue et montant |
| payments/payment_received | Paiement et références des factures affectées |
| approvals/requested | Demandeur, référence, montant et date |
| approvals/approved | Décision positive |
| approvals/rejected | Refus et motif |
| notifications/generic | Contenu de la Notification persistée |

HTML simple avec styles en ligne, tables de présentation, échappement Django et aucune exécution JavaScript. Aucun lien d'action inventé. Les deux anciens TXT du lot asynchrone restent conservés ; le transport courant utilise les nouvelles paires.

## 5 — Celery tasks

| Task | Argument | But | Retry |
| --- | --- | --- | --- |
| apps.notifications.tasks.send_business_email_task | email_log_id | Facture, devis, commande fournisseur et paiement | Maximum 3 reprises, 60/120/240 secondes |
| apps.sales.tasks.send_invoice_reminder_email | reminder_id | Résoudre son BusinessEmail puis utiliser le transport commun | Même politique |
| apps.notifications.tasks.send_notification_email | notification_id | Notification générique ou e-mail d'approbation lié | Même politique |
| apps.reporting.tasks.expire_stalled_jobs | aucun | Rapprocher aussi les envois interrompus | Aucun retry automatique |

Les messages ne transportent pas d'adresse, de montant, de modèle Django ou de PDF. Les retries concernent les erreurs de connexion avant soumission et les refus SMTP temporaires explicites. Adresse invalide, droits perdus, configuration permanente et état métier invalide ne sont pas rejoués. Une déconnexion après soumission donne uncertain, sans réémission automatique.

## 6 — Business triggers et transaction.on_commit

Le seul point de publication est `common.dispatch.enqueue_after_commit`, qui appelle `transaction.on_commit(..., robust=True)`. `notifications.email_services.prepare_email` persiste le journal puis appelle `publish_email_after_commit` pour les nouvelles demandes valides.

| Transaction métier | Chaîne de préparation | Destinataire |
| --- | --- | --- |
| sales.invoice_workflows.request_invoice_email | request_document_email → prepare_email | Client de la facture |
| sales.invoice_workflows.request_reminder | prepare_reminder_email → prepare_email | Client de la facture échue |
| sales.services.transition_quote, action send | request_document_email → prepare_email | Client du devis |
| purchasing.services.transition_purchase_order, action send | request_document_email → prepare_email | Fournisseur de la commande |
| finance.services.create_payment, après allocate_payment | prepare_email, strict=False | Client du paiement entrant |
| approvals.services._new_request | notify_approval_requested → create_notification → prepare_notification_email | Membres autorisés à décider |
| approvals.services._decide | notify_approval_decision → même chaîne | Demandeur autorisé |
| notifications.services.create_notification | prepare_notification_email → prepare_email | Destinataire persistant |

Rollback : journal, audit et callback annulés ensemble. Panne broker après commit : journal failed/broker_unavailable et audit, sans annuler l'opération financière déjà validée. Une adresse manquante pour un paiement ou une notification automatique produit un échec secondaire traçable, pas un échec de comptabilisation.

API ajoutée : `POST /api/invoices/:id/send/`. APIs réutilisées : remind, quotes/send, purchase-orders/send. Historique : `GET /api/business-emails/?entity_type=...&entity_id=...`. `resend=true` avec nouvelle Idempotency-Key distingue un renvoi explicite d'une répétition accidentelle. Les réponses document existantes restent HTTP 200.

## 7 — Attachments

| Pièce jointe | Implémentation |
| --- | --- |
| Invoice PDF | Oui : reporting.pdf_selectors.commercial_pdf_data + common.pdf.commercial.render_commercial_pdf |
| Quote PDF | Oui : même sélecteur et moteur ; purpose=email respecte quotes.send/view |
| Purchase Order PDF | Non : moteur existant absent, aucun deuxième générateur créé |

Le PDF est généré dans le worker. Les routes de téléchargement existantes gardent leurs permissions propres. Aucun upload utilisateur arbitraire, fichier binaire dans Valkey ou pièce d'une autre société.

## 8 — Multi-company

La société est dérivée des objets chargés depuis PostgreSQL ; le body ne peut pas fournir un company_id de confiance. Le worker recharge l'entité dans la société du journal, les relations client/fournisseur et les permissions courantes. Les utilisateurs inactifs, sociétés inactives, relations incohérentes et droits révoqués sont refusés.

Branding : Company réelle, legal_name/name, coordonnées et footer de sa configuration de facturation. Les scans et les destinataires d'approbation restent filtrés société par société. L'historique vérifie société et accès à l'objet ; pour les approbations il reste privé au destinataire de l'e-mail.

## 9 — Security

Credentials SMTP uniquement dans l'environnement ; aucune valeur réelle ajoutée au dépôt. Les logs opérationnels contiennent IDs, type, état et codes contrôlés, jamais le corps, les credentials ou les binaires. AuditLog reçoit uniquement des métadonnées allowlistées, sans adresse complète ni HTML.

Validation Django des adresses avant queue manuelle et à nouveau dans le worker. Aucun From/Reply-To/Bcc pris depuis le body. Sujet et nom affiché nettoyés, HTML échappé, pièces jointes issues des sélecteurs autorisés. Claims PostgreSQL courts, tentatives bornées, fencing des workers expirés et déduplication durable.

Le backend console est une fonction de développement explicite : il affiche le MIME localement. Son résultat ne prétend pas à une livraison externe et n'est pas copié intégralement dans les rapports.

## 10 — Tests

Les commandes du harness exécutent réellement `manage.py test ... --settings=config.settings.test --noinput --verbosity 1` sur un PostgreSQL isolé. Aucun SMTP externe ni broker réel dans ces tests.

| Commande / passage | Tests exécutés | Réussis | Échecs | Erreurs |
| --- | ---: | ---: | ---: | ---: |
| manage.py check | — | contrôle OK | 0 | 0 |
| manage.py makemigrations --check | — | No changes detected | 0 | 0 |
| manage.py migrate | — | migrations appliquées | 0 | 0 |
| test_postgres.ps1 -Labels apps.notifications,apps.reporting.tests.test_async_jobs,apps.reporting.tests.test_async_concurrency,apps.finance.tests.test_async_scan,apps.inventory.tests.test_async_scan,apps.sales.tests.test_quotes,apps.purchasing.tests.test_api | 52 | 52 | 0 | 0 |
| test_postgres.ps1 -Labels apps.notifications.tests.test_business_emails | 18 | 18 | 0 | 0 |
| test_postgres.ps1 — premier passage complet | 273 | 272 | 1 | 0 |
| test_postgres.ps1 — passage complet corrigé | 273 | 273 | 0 | 0 |
| test_postgres.ps1 -Labels apps.finance,apps.inventory,apps.reporting,apps.sales,apps.purchasing,apps.approvals,apps.notifications,apps.audit,common | 180 | 180 | 0 | 0 |
| npm.cmd run build | — | build OK | 0 | 0 |
| npm.cmd run lint | — | lint OK | 0 | 0 |
| Playwright async-email-contracts.spec.ts, navigateur par défaut absent | 0 corps de test exécuté | 0 | 2 lancements refusés | — |
| Même fichier avec Chrome installé | 2 | 2 | 0 | 0 |

L'échec du premier passage complet était une ancienne assertion 404 sur `/invoices/:id/send/` : cette route existe désormais et refuse correctement 403 à un rôle sans invoices.send. Le premier lancement navigateur cherchait un Chromium Playwright non installé ; Chrome existant a permis d'exécuter les deux parcours, sans téléchargement de navigateur.

Couverture : HTML/texte, expéditeur et société, PDF réel lu avec pypdf, adresses manquantes, isolation et révocation, rollback/on_commit, doubles clics et renvoi, échec de broker, refus SMTP temporaire/permanent, déconnexion ambiguë, paiement inchangé, approbations et audit. Les tests de stock/export et de concurrence du socle restent intégrés.

Vérification finale du garde-fou de collision après expiration : **en cours de consignation**.

## 11 — Celery / Valkey

Valkey : **PONG**. Worker Windows solo connecté à la vraie instance locale. Extrait réel du script `check_business_email_worker.py` :

```text
Task apps.notifications.tasks.send_business_email_task[d5c75674-edae-476e-aab3-e35323fa05d4] received
Task apps.notifications.tasks.send_business_email_task[d5c75674-edae-476e-aab3-e35323fa05d4] succeeded ... {'id': 1, 'status': 'sent', 'code': ''}
BusinessEmail: sent; sent timestamp persisted; backend=console
MIME: text/plain + text/html + invoice PDF verified
External SMTP: NOT USED
Owned diagnostic worker stopped
Owned disposable company/user/invoice/email/audit records removed
```

Les retries SMTP sont vérifiés par tests contrôlés, pas par une panne réseau volontaire sur un SMTP réel. La tâche métier de nettoyage a aussi été reçue et exécutée via le broker, UUID `f951bed7-de0a-44b3-9e84-592f32105272`, résultat `{'deleted': 0}`. Les workers de diagnostic sont arrêtés ; Valkey reste actif.

## 12 — Limitations

SMTP de production à configurer et livraison distante non testée. Backend console utilisé pour la preuve réelle. Pas de PDF commande fournisseur, de préférences détaillées par société, de SMTP multi-société, d'IMAP, tracking, marketing, IA, SMS ou push. Templates français et branding textuel ; pas de lien frontend public ni logo embarqué dans le corps d'e-mail. Les PDF conservent leur propre branding existant.

Le workflow commercial sent reste indépendant du succès du transport. SMTP ne garantit pas exactement une livraison après coupure ambiguë ; uncertain exige une vérification avant renvoi. Publication après commit sans outbox distribuée : une interruption exacte entre commit et callback est rapprochée par expiration, pas rejouée aveuglément. Activer Beat ou utiliser les commandes de maintenance documentées ; les consultations rapprochent également les états expirés.

## 13 — Git

Aucun commit, aucun push, aucun reset ni flush de la base applicative. Migrations additives 0002 et 0003 appliquées, historique préservé. `git diff --check` valide. Les fichiers et changements restent disponibles à l'inspection, ainsi que le script reproductible de vérification worker.

```powershell
git status --short
git diff --stat
git diff
git ls-files --others --exclude-standard
```

Les nouveaux fichiers ne sont pas inclus dans `git diff` tant qu'ils ne sont pas indexés ; leur inventaire détaillé figure dans le manifeste lié en section 2.
