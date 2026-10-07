# Livraison — Valkey / Celery Broker

Date : 5 octobre 2026. Audit préalable : [VALKEY_CELERY_AUDIT.md](VALKEY_CELERY_AUDIT.md). Procédure PowerShell complète : [CELERY_VALKEY.md](CELERY_VALKEY.md).

## SECTION 1 — STATUS

| Élément | Statut | Preuve |
| --- | --- | --- |
| Valkey | DONE | Conteneur healthy ; PING réel = PONG ; port lié à 127.0.0.1 |
| Celery Broker connection | DONE | Connexion réelle à Valkey depuis le worker |
| Celery Worker | DONE | Worker Windows solo connecté et prêt ; arrêté après le diagnostic |
| Test task | DONE | Même UUID envoyé, reçu et terminé avec `ok` ; aucun result backend |

## SECTION 2 — FILES

Créés :

- `common/tasks.py`
- `common/tests/test_celery.py`
- `compose.valkey.yml`
- `scripts/check_celery_broker.py`
- `docs/VALKEY_CELERY_AUDIT.md`
- `docs/CELERY_VALKEY.md`
- `docs/VALKEY_CELERY_REPORT.md`

Modifiés : `.env.example`, `config/celery.py`, `config/__init__.py`, les quatre fichiers `config/settings/{base,development,production,test}.py`, et `requirements/{base,development,production}.txt`.

Supprimés : aucun. Aucun modèle, migration, endpoint, serializer ou workflow métier ajouté ou modifié dans ce lot. Les travaux antérieurs du dépôt sont conservés ; ce rapport ne les déclare pas terminés.

## SECTION 3 — CONFIGURATION

Seule nouvelle variable d'environnement nécessaire :

```dotenv
CELERY_BROKER_URL=redis://localhost:6379/0
```

Les réglages Celery utilisent JSON uniquement, le fuseau Django, la file `smarterp`, les résultats ignorés et la reconnexion initiale. `DJANGO_SETTINGS_MODULE` existant reste prioritaire. Le défaut localhost est limité au développement. Production exige l'URL par environnement. Les tests utilisent `memory://`, eager et propagation des exceptions.

Le vrai `.env` n'est ni modifié ni reproduit dans ce rapport. La clé Django présente dans l'ancien exemple a été remplacée par un placeholder explicite.

## SECTION 4 — DEPENDENCIES

Ajout déclaré : `celery[redis]==5.6.3`, qui inclut le client Python Redis requis par Kombu. Les versions runtime précédentes sont conservées à l'identique et centralisées dans `requirements/base.txt`. Development et production incluent ce fichier ; aucune duplication de déclaration Celery/Redis.

Installés et vérifiés : Celery 5.6.3, client Redis 6.4.0, Kombu 5.6.2. `pip check` : `No broken requirements found.` Aucun downgrade de dépendance existante.

Dépendances transitives ajoutées : amqp 5.4.1, billiard 4.3.1, click 8.5.0, click-didyoumean 0.3.1, click-plugins 1.1.1.2, click-repl 0.4.1, packaging 26.3, prompt_toolkit 3.0.53, python-dateutil 2.9.0.post0, six 1.17.0, tzlocal 5.4.4, vine 5.1.0 et wcwidth 0.9.2.

## SECTION 5 — VALKEY

| Paramètre | Valeur |
| --- | --- |
| Hôte client | localhost |
| Port | 6379 |
| Base logique | 0 |
| Image | valkey/valkey:9.1.2-alpine |
| Publication Docker | 127.0.0.1:6379 uniquement |
| Projet Compose | smarterp-broker |
| Healthcheck | valkey-cli ping, toutes les 5 s |
| Persistance locale | AOF et volume nommé valkey-data |

Docker Desktop était arrêté lors de l'audit ; il a été démarré pour la validation. L'image officielle est téléchargée et le conteneur a répondu `PONG`. [Version officielle de Valkey](https://valkey.io/download/).

## SECTION 6 — CELERY

Application `smarterp`, exportée sous `config.celery_app`. Découverte automatique des `tasks.py` des apps installées, avec import explicite de `common.tasks`.

```powershell
# Développement Windows, depuis backend
.\.venv\Scripts\celery.exe -A config worker -l info --pool=solo
```

```sh
# Linux/conteneur, environnement de production configuré
celery -A config worker -l info
```

`solo` n'est pas forcé dans les settings. Aucun result backend persistant, aucun Beat, aucune tâche métier. Le diagnostic utilise une file et un worker temporaires propres à chaque exécution, puis arrête son worker. [Django et Celery](https://docs.celeryq.dev/en/stable/django/first-steps-with-django.html).

## SECTION 7 — TEST

| Commande / vérification | Résultat |
| --- | --- |
| `docker compose -f compose.valkey.yml config --quiet` | PASS |
| `docker compose -f compose.valkey.yml up -d --wait --wait-timeout 60` | PASS — healthy |
| `docker compose -f compose.valkey.yml exec -T valkey valkey-cli ping` | PONG |
| `.venv\Scripts\python.exe manage.py check` | PASS — `System check identified no issues (0 silenced).` |
| `.venv\Scripts\python.exe manage.py makemigrations --check` | ÉCHEC préexistant à ce lot — libellé `Payment.direction`, voir ci-dessous |
| `.venv\Scripts\python.exe manage.py test common.tests.test_celery --settings=config.settings.test --verbosity 1` | PASS — 5 tests, 5 réussis, 0 échec, 0 erreur ; 3,200 s |
| `scripts\test_postgres.ps1 -Labels apps.accounts,apps.finance,apps.inventory,apps.reporting` | PASS — 116 tests, 116 réussis, 0 échec, 0 erreur ; 61,537 s |
| `.venv\Scripts\python.exe scripts\check_celery_broker.py` | PASS — 1 scénario réel, code de sortie 0 |
| `.venv\Scripts\python.exe -m pip check` | PASS — aucune dépendance incompatible |
| `git diff --check` | PASS |

Le script PostgreSQL invoque `manage.py test` avec ces quatre labels sur un cluster de test séparé, puis l'arrête. Aucun test n'a réinitialisé la base de développement. Les tests existants ont conservé les settings development ; les cinq tests techniques ont utilisé les settings test.

Sortie exacte du diagnostic de bout en bout :

```text
Valkey PING: PONG
Celery worker: connected and ready (solo diagnostic)
Task sent: f83bf158-869c-4d9d-900d-fa201e7634b7
Task received: YES
Task succeeded: ok
Result backend: disabled; result.get() not used
Diagnostic worker stopped
```

Le script vérifie les lignes received/succeeded et le message `ok` dans les journaux réels de son worker pour cet UUID. Valkey reste démarré et healthy ; le worker technique est arrêté. Aucun worker métier permanent n'a été lancé.

Le contrôle de migrations détecte `finance.0007_alter_payment_direction` : la migration existante 0005 contient le libellé mal encodé `DÃ©caissement`, tandis que le modèle contient `Décaissement`. Les fichiers concernés sont identiques à la base `fbc2af6`, vérification effectuée après les tests. Ce décalage provient du lot antérieur. Aucune migration 0007 n'a été créée ni appliquée par cette mission d'infrastructure. Les valeurs métier `incoming`/`outgoing` ne changent pas.

Deux premières tentatives pip ont échoué sur des délais de téléchargement réseau ; l'installation a ensuite abouti, puis le résolveur standard a complété le transport Redis. La première exécution des cinq tests techniques avait 4 succès et 1 échec : Celery donnait priorité à la variable d'environnement du broker. Les settings test isolent désormais cette variable dans le processus de test ; les cinq tests ont été relancés et passent. Les chiffres finaux ci-dessus correspondent aux exécutions réussies après correction.

## SECTION 8 — PRODUCTION NOTES

Définir l'URL du broker et `DJANGO_SETTINGS_MODULE=config.settings.production` dans l'environnement. Utiliser un réseau privé, sans publication Internet du port Valkey ; authentification/TLS à adapter à l'infrastructure. Ne placer aucun identifiant réel dans Git. PostgreSQL reste la source de vérité de toutes les données métier, y compris futurs rapports et notifications persistantes.

## SECTION 9 — LIMITATIONS

Prochaine tâche : implémentation réelle des tâches asynchrones métier, avec publication après commit et contrôle du tenant dans les traitements concernés. Ni cache global, sessions Redis, WebSockets, pub/sub applicatif, email provider, Beat, result backend ou tuning de production dans ce lot.

Le fonctionnement de production Linux n'est pas déployé ici. Windows utilise le mode de développement solo ; Windows n'est pas officiellement pris en charge par Celery. [Limites de plateforme Celery](https://docs.celeryq.dev/en/stable/getting-started/introduction.html).

Le décalage de migration Finance décrit en section 7 reste à corriger dans le lot précédent, avec une migration additive si la migration 0005 est déjà appliquée. Ce contrôle n'est pas déclaré réussi.

## SECTION 10 — GIT

Aucun commit ni push effectué par l'agent. Base constatée au début de ce lot : `fbc2af6` (`config documents and reporting and scripts`). Inspection :

```powershell
git status --short
git diff --stat
git diff -- backend/config backend/requirements
git diff --check
```

Les nouveaux fichiers restent visibles dans `git status`; un `git diff` simple ne montre pas leur contenu tant qu'ils ne sont pas suivis. L'ancien exemple d'environnement contenait une clé : éviter d'en recopier le diff dans un rapport partagé.
