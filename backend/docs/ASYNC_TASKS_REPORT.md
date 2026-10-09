# SmartERP AI — rapport du socle asynchrone

8 octobre 2026. Le socle initial est présent dans `3412be5`. Le lot e-mails reçu pendant sa validation a finalisé la livraison et sa traçabilité ; les tests finaux portent sur les deux lots. Audit avant implémentation : [ASYNC_TASKS_AUDIT.md](ASYNC_TASKS_AUDIT.md). Guide : [ASYNC_TASKS.md](ASYNC_TASKS.md).

## 1 — Status

| Task | État |
| --- | --- |
| scan_overdue_invoices | DONE |
| scan_low_stock | DONE |
| cleanup_expired_idempotency_keys | DONE |
| send_invoice_reminder_email | DONE |
| send_notification_email | DONE |
| generate_report_export | DONE |
| generate_large_excel_export | DONE |
| generate_large_pdf | DONE |

## 2 — Files

Créés : app notifications, services/selectors des scans Finance/Inventory, services/vues/sélecteurs de jobs Reporting, common.dispatch/scans/email_delivery, tests asynchrones et concurrence, migrations Audit/Notifications/AsyncJob/états de relance, documentation. Modifiés : tasks des apps concernées, settings/routes, triggers de relance et décision, bibliothèque frontend des rapports, harness PostgreSQL et sélection des settings de test. Une migration Finance additive corrige le libellé de direction du paiement. Aucun fichier métier supprimé.

Pour le socle déjà présent : `git show --stat 3412be5`. Pour le complément e-mails : [inventaire](BUSINESS_EMAILS_FILES.md).

## 3 — Tasks

Le [catalogue détaillé](ASYNC_TASKS.md#catalogue) donne module, signature, type, déclencheur, retry et finalité des huit tâches, ainsi que la maintenance d'expiration et le transport BusinessEmail ajouté ensuite. Aucun payload métier volumineux ; aucun pickle ; aucun request dans les workers.

## 4 — Periodic tasks

Activation explicite de Beat. Africa/Casablanca : retard à 07:00, stock à 08:00, nettoyage à 02:00, récupération des traitements à chaque heure :15. Un seul scheduler, pas de polling métier agressif ni d'infrastructure distribuée supplémentaire.

## 5 — AsyncJob model

Company, requested_by, job_type, entity, target_id, parameters JSON, format, status, filename, result_file, error_code/message, created_at/started_at/completed_at, lease_expires_at, claim_token, attempts.

États pending/processing/completed/failed. Contraintes : statut valide, couples type/format/cible valides, fichier et date obligatoires si completed. Index société/demandeur/date et statut/échéance. Un modèle générique couvre CSV, XLSX et PDF ; GeneratedExport synchrone existant est conservé.

## 6 — API

POST `/api/reports/export/`, POST `/api/jobs/pdf/`, GET `/api/jobs/`, GET `/api/jobs/:id/`, GET `/api/jobs/:id/download/`, POST `/api/jobs/:id/retry/`. Création 202 avec Idempotency-Key ; fichiers privés et autorisés. Notification : GET `/api/notifications/`, POST `/api/notifications/:id/read/`, POST `/api/notifications/read-all/`. Le guide détaille les corps et droits.

## 7 — transaction.on_commit

Publication centralisée dans `common.dispatch.enqueue_after_commit`. Emplacements appelants : `reporting.job_services.request_job`, `reporting.job_services.retry_job` ; e-mails via `notifications.email_services.publish_email_after_commit`, lui-même appelé lors de la préparation de la relance ou de la notification. Les notifications de décision passent par `approvals.services._decide`. La liste complète actualisée des triggers est en [section 6 du rapport e-mails](BUSINESS_EMAILS_REPORT.md#6--business-triggers-et-transactionon_commit).

## 8 — Multi-company

Scans sur Company active, requêtes bornées par société et relations. Stock : dépôt actif, produits physiques actifs, seuil existant, aucune mutation ni StockMovement. Overdue reste calculé, sans changement de statut comptable. Chaque worker recharge société, entité, demandeur/destinataire, état et droits. Les jobs exigent **société + propriétaire + permissions courantes**, sans bypass administrateur global. PDF et exports utilisent les sélecteurs existants.

## 9 — Idempotency

Notifications uniques société/destinataire/événement. Claims atomiques et jetons d'exécution ; duplicate task sans deuxième fichier publié ni deuxième envoi terminé. Registre de requêtes avec empreinte et rétention 30 jours pour les jobs ; mêmes paramètres/même clé renvoient le même job, conflit sinon. Nettoyage strict `expires_at < now`, null et clés actives conservés, clés financières embarquées inchangées. Le suivi e-mail est désormais centralisé dans BusinessEmail et synchronisé vers les objets historiques.

## 10 — Tests

Résultats finaux et commandes : [section 10 du rapport e-mails](BUSINESS_EMAILS_REPORT.md#10--tests). Suite complète corrigée : 273 réussis, 0 échec, 0 erreur. Apps ciblées Finance/Inventory/Reporting/Sales/Purchasing/Approvals/Notifications/Audit/Common : 180 réussis, 0 échec, 0 erreur. Build/lint et deux parcours navigateur réussis. Le premier lot avait également validé 37 tests asynchrones incluant des courses PostgreSQL.

Les erreurs contrôlées affichées pendant les tests sont provoquées par mocks : broker, stockage et SMTP. Aucun test ne dépend de Valkey ni n'envoie de vrai SMTP.

## 11 — Celery validation

Valkey PONG. Worker local connecté. Task réelle `apps.audit.tasks.cleanup_expired_idempotency_keys`, UUID `f951bed7-de0a-44b3-9e84-592f32105272`, received puis succeeded avec `{'deleted': 0}`. Une facture a également été envoyée via worker et backend console avec HTML/texte/PDF ; preuve dans le rapport e-mails. Aucun `result.get()` ; les workers temporaires sont arrêtés.

## 12 — Limitations

Pas de backend de résultats Celery ; les états résident dans PostgreSQL. Pas de cycle automatique de réouverture d'alertes résolues, de rétention automatique des exports, ni de nettoyage des fichiers orphelins après kill au milieu d'une écriture. Les files sont publiées après commit sans outbox distribuée. Les échéances bornent les états visibles ; elles ne tuent pas un calcul long du pool solo. Le SMTP de production reste à configurer. Aucun traitement IA, cache global, verrou distribué custom, Kafka ou WebSocket.

## 13 — Git

Aucun commit/push exécuté par cet agent. Le dépôt contient déjà le commit du socle mentionné ci-dessus ; les compléments actuels restent inspectables par `git status`, `git diff`, le manifeste de fichiers, les migrations, les tests et les scripts de worker.
