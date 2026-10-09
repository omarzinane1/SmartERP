# Audit préalable — e-mails métier

8 octobre 2026. Mission reçue pendant la validation du lot Celery ; ses changements sont conservés, sans commit. Frontend réel : `smarterp-ai/`.

| Fonction | État réel | Décision |
| --- | --- | --- |
| Celery, Valkey, publication après commit | IMPLEMENTED ; tâches à IDs, JSON, publication bornée, mode eager pour tests | Réutiliser |
| Relance facture / notification générique | PARTIAL ; transport central, suivi par objet, TXT, reprise bornée et état incertain | Conserver les signatures publiques ; centraliser la traçabilité, ajouter HTML |
| BusinessEmail / EmailLog | MISSING ; états séparés dans InvoiceReminder et Notification | Ajouter BusinessEmail dans l'app notifications ; états historiques projetés dans les objets existants |
| SMTP | PARTIAL ; opt-in, locmem tests, backend SMTP fixé | Backend configurable ; console locale autorisée et identifiée comme telle, pas de SMTP forcé en développement |
| Facture envoyée | MISSING ; bouton existant désactivé, permission invoices.send existante | Action send, PDF ReportLab existant, idempotence et renvoi explicite |
| Devis envoyé | PARTIAL ; endpoint et transition officiels présents, uniquement attestation d'envoi externe | Ajouter préparation e-mail dans le service transactionnel existant ; task sans transition métier |
| Commande fournisseur envoyée | PARTIAL ; endpoint et transition présents, envoi externe seulement | Même intégration ; aucun moteur PDF achat existant, ne pas en inventer |
| Confirmation paiement | MISSING ; création et allocations synchrones | E-mail secondaire après création du paiement entrant ; absence d'adresse ne doit pas annuler la comptabilisation |
| Approbation demandée | PARTIAL ; demande persistée, aucun destinataire assigné | Notifier les membres actifs autorisés à lire et décider ce type de demande dans cette société |
| Approbation décidée | PARTIAL ; notification générique existante, dédupliquée | Réutiliser une seule notification par événement ; modèles approved/rejected dédiés |
| HTML / branding | MISSING ; deux templates TXT simples | Base HTML compatible e-mail, versions texte, identité et coordonnées issues de Company |
| PDF | IMPLEMENTED facture/devis, sélecteur scoped + ReportLab commun | Réutiliser le moteur ; autorisation adaptée à l'envoi, sans route de téléchargement supplémentaire |
| Audit | PARTIAL ; AuditLog et service de sanitisation existants et activés | Métadonnées uniquement pour queued/sent/failed ; pas de corps ni de credentials |
| UI | PARTIAL ; actions send/remind existent, certains textes annoncent encore l'absence d'e-mail | Raccorder et corriger les messages ; pas de refonte |

Contraintes : aucun SMTP externe lors des tests ; démonstration réelle via worker et backend console sur des données locales dédiées. Les coupures SMTP ambiguës restent `uncertain` et ne sont pas automatiquement rejouées. Un résultat console signifie accepté par le backend de développement, jamais livré à une boîte distante.

Les migrations du lot précédent ont été appliquées : elles ne seront pas réécrites. Les changements suivants utiliseront des migrations additives.
