# Audit préalable — broker Valkey / Celery

Date : 5 octobre 2026. Périmètre : infrastructure asynchrone uniquement.

| Élément inspecté | État avant modification | Décision |
| --- | --- | --- |
| `config/celery.py`, `config/__init__.py` | MISSING : fichiers vides | Application Celery standard et import au démarrage |
| Settings base / development / production / test | MISSING : aucune option Celery | JSON, fuseau Django, broker via environnement, eager réservé aux tests |
| Sélection des settings | IMPLEMENTED : `DJANGO_SETTINGS_MODULE`, `setdefault` development dans manage.py / WSGI / ASGI | Conserver la sélection explicite et le même défaut local |
| Dépendances | MISSING : ni celery ni redis ; dépendances runtime dans development.txt, base et production vides | Centraliser les dépendances runtime existantes dans base ; ajouter le transport Celery Redis sans doublons |
| `.env.example` | CONFLICT / RISK : exemple contenant une clé Django non neutre | Remplacer uniquement l'exemple par un placeholder ; ne pas lire ni modifier le vrai `.env` |
| Docker / Compose | MISSING : aucun fichier d'infrastructure existant | Petit Compose dédié à Valkey, port lié exclusivement à 127.0.0.1 |
| Docker local | PARTIAL : client 28.5.1 et distributions WSL présents ; moteur initialement arrêté | Démarrer le moteur pour vérifier PING et le worker |
| Tâches existantes | MISSING : modules préparés mais aucune tâche Celery fonctionnelle | Une tâche technique sans accès aux données dans `common/tasks.py` |
| Result backend / Beat | MISSING, aucun besoin actuel | Ne pas configurer de backend de résultats ni de planification |
| Métier / PostgreSQL | IMPLEMENTED, travaux antérieurs présents | Aucune route, aucun serializer ni workflow modifié dans ce lot |

Audit effectué avant les modifications de ce lot. Les développements antérieurs Reporting / Dashboard / Audit restent distincts et ne sont pas déclarés terminés par cette livraison d'infrastructure.
