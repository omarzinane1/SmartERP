# Tâches asynchrones — exploitation locale

PostgreSQL conserve les états métier, les notifications, AsyncJob et BusinessEmail. Valkey ne transporte que les messages Celery JSON : un ID ou aucun argument. Les comptabilisations, affectations, décisions, réceptions et mouvements de stock restent synchrones.

## Démarrage

Depuis `backend/`, après les migrations :

```powershell
docker desktop start --timeout 60
docker compose -f compose.valkey.yml up -d --wait
docker compose -f compose.valkey.yml exec -T valkey valkey-cli ping
$env:DJANGO_SETTINGS_MODULE = 'config.settings.development'
.\.venv\Scripts\celery.exe -A config worker -l info --pool=solo
```

Le service réel s'appelle `smarterp-broker-valkey-1`. Worker local Windows : pool solo. Les limites de temps Celery ne constituent pas un arrêt forcé fiable avec ce pool ; les échéances persistantes empêchent un worker arrivé trop tard de publier son résultat.

Dans un terminal séparé, pour les traitements périodiques :

```powershell
$env:DJANGO_SETTINGS_MODULE = 'config.settings.development'
$env:CELERY_BEAT_ENABLED = 'true'
.\.venv\Scripts\celery.exe -A config beat -l info --schedule .test-postgres\celerybeat-schedule
```

Lancer **un seul Beat** pour ce broker. Le fichier de planning local est placé dans le répertoire ignoré existant. En production, prévoir un emplacement persistant adapté. Sans Beat, les commandes manuelles restent utilisables ; consulter un job ou l'historique de ses e-mails rapproche aussi les états expirés.

## Catalogue

Tous les modules ci-dessous commencent par `apps.`.

| Task / module | Arguments | Type / déclencheur | Horaire Casablanca si Beat activé | Retry automatique | But |
| --- | --- | --- | --- | --- | --- |
| finance.tasks.scan_overdue_invoices | aucun | scan manuel/Beat | 07:00 quotidien | aucun ; relance sûre grâce à déduplication | Factures comptabilisées, échues, solde positif |
| inventory.tasks.scan_low_stock | aucun | scan manuel/Beat | 08:00 quotidien | aucun | Disponible ≤ minimum par dépôt actif, y compris zéro sans ligne de stock |
| audit.tasks.cleanup_expired_idempotency_keys | aucun | maintenance | 02:00 quotidien | aucun | Suppression par lots de 500 des seules clés expirées |
| sales.tasks.send_invoice_reminder_email | reminder_id | après commit d'une relance | aucun | 3 maximum, 60/120/240 s, erreurs SMTP temporaires sûres | Envoi via BusinessEmail lié |
| notifications.tasks.send_notification_email | notification_id | après commit de Notification | aucun | même politique | Notification ou approbation, sans créer une seconde notification |
| notifications.tasks.send_business_email_task | email_log_id | après commit de BusinessEmail | aucun | même politique | Facture/devis/commande/paiement |
| reporting.tasks.generate_report_export | job_id | après commit du job CSV | aucun | 3 maximum, 30/60/120 s, erreurs de stockage transitoires ciblées | Réutiliser le générateur CSV |
| reporting.tasks.generate_large_excel_export | job_id | après commit du job Excel | aucun | même politique | iterator SQL + openpyxl write-only |
| reporting.tasks.generate_large_pdf | job_id | après commit du job PDF explicite | aucun | même politique | Moteur ReportLab facture/devis existant |
| reporting.tasks.expire_stalled_jobs | aucun | maintenance | chaque heure à :15 | aucun | Jobs interrompus et envois au résultat incertain |

Timezone : `CELERY_TIMEZONE = TIME_ZONE = Africa/Casablanca`. Désactivé par défaut via `CELERY_BEAT_ENABLED=false`. Les scans évaluent les échéances à la date propre de chaque Company active.

## Commandes manuelles

```powershell
.\.venv\Scripts\python.exe manage.py shell -c "from apps.finance.tasks import scan_overdue_invoices; print(scan_overdue_invoices.delay().id)"
.\.venv\Scripts\python.exe manage.py shell -c "from apps.inventory.tasks import scan_low_stock; print(scan_low_stock.delay().id)"
.\.venv\Scripts\python.exe manage.py shell -c "from apps.reporting.tasks import expire_stalled_jobs; print(expire_stalled_jobs.delay().id)"
.\.venv\Scripts\python.exe scripts\check_celery_broker.py --task cleanup
```

Le dernier script démarre son propre worker sur une file unique, exécute réellement le nettoyage des clés expirées, vérifie received/succeeded du même UUID, puis arrête seulement ce worker. Aucun result backend ni `result.get()`.

## API des jobs

Session authentifiée, société active, CSRF habituel et droits métier en vigueur. `Idempotency-Key` de 8 à 128 caractères obligatoire à la création.

| Endpoint | Contrat |
| --- | --- |
| POST /api/reports/export/ | `{ "report_id": "customers", "format": "csv", "filter": "Alpha" }` ; CSV ou XLSX ; filtres existants conservés |
| POST /api/jobs/pdf/ | `{ "entity_type": "invoice", "entity_id": 123 }` ; `quote` également |
| GET /api/jobs/ | Liste paginée des jobs du demandeur dans la société active, sous ses droits actuels |
| GET /api/jobs/123/ | `id`, `status`, `error_code`, `error_message`, `download_url` et métadonnées |
| GET /api/jobs/123/download/ | Fichier terminé seulement ; autorisation réévaluée ; private/no-store |
| POST /api/jobs/123/retry/ | Corps `{}` ; échec seulement ; nouvelle publication après commit |

Création : HTTP 202. `status` vaut pending, processing, completed ou failed. Aucun pourcentage inventé. Les anciens exports et PDF synchrones restent disponibles. La bibliothèque frontend des rapports interroge le statut tant qu'un job attend ou s'exécute et propose sa relance après échec.

## Reprise et isolation

Un job prend un claim PostgreSQL court puis génère hors transaction. Le résultat n'est publié qu'avec le même jeton encore valide. Échéance d'exécution : 20 minutes ; attente sans démarrage : 24 heures. La consultation des jobs et la maintenance peuvent marquer les échéances dépassées en échec. Relancer un job échoué remet une échéance d'attente neuve.

Les e-mails utilisent une politique conservatrice : après interruption pendant la soumission SMTP, l'état est `uncertain`, sans renvoi automatique. Le guide [BUSINESS_EMAILS.md](BUSINESS_EMAILS.md) détaille les limites.

Déduplication des scans : société + utilisateur + événement. Une alerte facture est créée une seule fois par facture/destinataire ; une alerte stock une seule fois par produit/dépôt/destinataire. Un cycle de résolution puis réouverture d'alerte reste hors périmètre. Les clés financières embarquées dans Payment, allocations, mouvements et relances ne sont jamais nettoyées par la task de maintenance.

Les fichiers ne sont servis que par les endpoints autorisés. Ne pas exposer directement `MEDIA_ROOT`. Un arrêt brutal entre écriture du fichier et enregistrement du résultat peut laisser un fichier orphelin ; le nettoyage automatique de ces orphelins reste à prévoir. Une panne broker après commit est enregistrée en échec ; aucune transaction financière déjà validée n'est annulée. Pas d'outbox distribuée garantissant la publication après un arrêt du processus exactement entre commit et callback.

## Tests

```powershell
.\.venv\Scripts\python.exe manage.py test --settings=config.settings.test
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
.\scripts\test_postgres.ps1
.\scripts\test_postgres.ps1 -Labels apps.finance,apps.inventory,apps.reporting,apps.notifications,apps.audit
```

Le harness utilise un PostgreSQL isolé sur 55439. Le mode test impose le transport mémoire, eager et la messagerie locmem. Aucun Valkey ni SMTP externe n'est requis. Les scripts de vérification réelle sont séparés des tests unitaires.
