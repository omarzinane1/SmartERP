# Audit préalable — tâches asynchrones métier

Date : 8 octobre 2026. Base : `ea12beb`. Frontend réel : `smarterp-ai/`, pas `frontend/`. Dépôt propre au démarrage de ce lot.

| Fonction | État constaté | Décision |
| --- | --- | --- |
| Celery / Valkey | IMPLEMENTED : JSON, autodiscover, settings séparés, tâche technique, Compose local | Conserver ; aucune nouvelle dépendance Python |
| scan_overdue_invoices | MISSING ; sélecteur de factures comptabilisées et règle d'échéance existants | Réutiliser ces règles et créer des notifications dédupliquées |
| scan_low_stock | MISSING ; règle existante **stock disponible ≤ minimum**, par dépôt actif, y compris stock zéro sans ligne StockLevel | Sélecteur SQL équivalent, sans mutation du stock |
| cleanup_expired_idempotency_keys | PARTIAL : modèle IdempotencyKey présent, app audit non installée et sans migration ; clés financières conservées dans les objets métier | Activer le modèle existant, l'utiliser pour les demandes de jobs ; ne nettoyer que ses lignes expirées |
| send_invoice_reminder_email | MISSING ; InvoiceReminder existe mais contrainte limitant son statut à requested ; pas d'infrastructure d'envoi | Étendre son suivi, SMTP via environnement, activation explicite, locmem dans les tests |
| send_notification_email | MISSING : app Notification absente | Fondation persistante, destinataire et société vérifiés, envoi après commit |
| generate_report_export | PARTIAL : GeneratedExport = fichier synchrone final, sans état de job | Conserver ce modèle et ajouter un seul AsyncJob pour les traitements différés |
| generate_large_excel_export | PARTIAL : moteur openpyxl write-only et iterator déjà corrects | Réutilisation intégrale du moteur |
| generate_large_pdf | PARTIAL : données scoped et moteur ReportLab existants | Job explicite facture/devis ; conserver les PDF synchrones existants |
| API / UI rapports | PARTIAL : statuts pending/ready/failed prévus ; génération encore synchrone | Nouveaux endpoints de jobs privés au demandeur ; raccordement des rapports avec interrogation de statut |
| Publication après commit | PARTIAL : utilisée pour nettoyer un fichier document ; aucune publication métier Celery | Publication après commit pour jobs, notifications et relances ; panne broker enregistrée sans annuler le métier déjà validé |
| Reprise / concurrence | MISSING pour les tâches | Claims PostgreSQL courts, idempotence, expiration des traitements interrompus, messages d'erreur contrôlés |
| Migrations Finance | CONFLICT / RISK : libellé Payment.direction corrigé dans le modèle mais pas dans l'état des migrations | Migration additive de libellé lors de ce lot ; aucune migration appliquée réécrite |

Les opérations critiques existantes restent synchrones. Les tâches ne prennent que des identifiants et rechargent droits, société, destinataire et état depuis PostgreSQL. Aucun résultat sensible ni fichier binaire dans Valkey. Aucun e-mail réel pendant les validations ; backend locmem exclusivement pour les tests.

Le protocole SMTP ne garantit pas l'unicité d'un envoi après une rupture survenue pendant sa soumission : cet état sera marqué incertain, sans réémission automatique aveugle. Les erreurs transitoires survenues avant soumission ou les refus SMTP temporaires explicites pourront être retentés un nombre borné de fois.
