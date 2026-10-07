# Valkey et Celery en développement

PostgreSQL reste la source de vérité de l'ERP. Valkey est uniquement le broker Celery : aucun cache global, session Django, résultat persistant ou stockage métier n'y est configuré. Ce lot ajoute une seule tâche technique, sans accès aux données métier.

## 1. Préparer le backend

Depuis PowerShell :

```powershell
Set-Location C:\Users\espacegamers\Desktop\SmartERP\backend
.\.venv\Scripts\python.exe -m pip install -r requirements\development.txt
```

Les dépendances runtime communes sont dans `requirements/base.txt`. Development et production l'incluent sans doublons. Conserver le `.env` local existant ; ajouter seulement cette variable si nécessaire :

```dotenv
CELERY_BROKER_URL=redis://localhost:6379/0
```

Le protocole reste `redis://` même avec un serveur Valkey. Hôte local `localhost`, port `6379`, base logique `0`. Le défaut local ne s'applique qu'aux settings development. `DJANGO_ENV` ne sélectionne pas les settings ; la variable reconnue est `DJANGO_SETTINGS_MODULE`.

## 2. Démarrer Valkey et vérifier PONG

Docker Desktop doit être démarré en mode conteneurs Linux.

```powershell
docker desktop start
docker compose -f compose.valkey.yml up -d --wait --wait-timeout 60
docker compose -f compose.valkey.yml ps
docker compose -f compose.valkey.yml exec -T valkey valkey-cli ping
```

Résultat attendu : `PONG`. L'image officielle est épinglée à `valkey/valkey:9.1.2-alpine`. Le port est lié uniquement à `127.0.0.1`. Le healthcheck teste PING toutes les cinq secondes. Le volume `valkey-data` et l'AOF conservent les messages du broker lors d'un redémarrage local ; ils ne constituent pas une base de données métier.

Si le port est déjà occupé, inspecter le service existant avant de démarrer une seconde instance. Ne pas arrêter ni effacer un broker partagé pour ce test.

## 3. Démarrer Django

Dans un terminal PowerShell ouvert sur le backend :

```powershell
$env:DJANGO_SETTINGS_MODULE = 'config.settings.development'
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py runserver
```

Le worker et les producteurs Django doivent utiliser la même URL de broker et le même environnement.

## 4. Démarrer le worker

Dans un deuxième terminal PowerShell ouvert sur le backend :

```powershell
$env:DJANGO_SETTINGS_MODULE = 'config.settings.development'
.\.venv\Scripts\celery.exe -A config worker -l info --pool=solo
```

`solo` sert au développement Windows. Celery ne prend pas officiellement Windows en charge ; utiliser Linux/WSL/conteneur pour un worker de production. Le démarrage doit indiquer la connexion au broker et la tâche `common.tasks.celery_healthcheck`. [Documentation Celery](https://docs.celeryq.dev/en/stable/getting-started/introduction.html).

Commande normale sous Linux, après activation de l'environnement Python et définition des settings/broker :

```sh
celery -A config worker -l info
```

La file par défaut est `smarterp`. Les tâches des applications installées sont découvertes automatiquement. `common.tasks` est importé explicitement, car `common` n'est pas une application métier Django. Aucun Beat ni horaire périodique n'est configuré.

## 5. Exécuter une tâche réelle

Dans un troisième terminal PowerShell ouvert sur le backend :

```powershell
.\.venv\Scripts\python.exe manage.py shell -c "from common.tasks import celery_healthcheck; task = celery_healthcheck.delay(); print(task.id)"
```

Vérifier dans le terminal du worker, pour le même UUID :

```text
Task common.tasks.celery_healthcheck[UUID] received
SmartERP Celery healthcheck: ok
Task common.tasks.celery_healthcheck[UUID] succeeded ...: 'ok'
```

La présence d'un UUID prouve l'envoi, pas l'exécution. Aucun result backend n'étant configuré, ne pas utiliser `result.get()` pour cette vérification.

Alternative automatisée, sans worker déjà lancé :

```powershell
.\.venv\Scripts\python.exe scripts\check_celery_broker.py
```

Le script exige un broker local réel, crée un worker technique sur une file unique, vérifie la connexion puis les journaux received/succeeded du même UUID, et arrête son propre worker. Il ne consomme pas la file métier `smarterp` et n'écrit aucune donnée ERP. Il ne démarre ni n'arrête Docker/Valkey.

## 6. Tests unitaires et arrêt

```powershell
.\.venv\Scripts\python.exe manage.py test common.tests.test_celery --settings=config.settings.test
```

Les tests utilisent eager + propagation des exceptions, avec un transport mémoire. Ils vérifient aussi la configuration production dans un processus séparé. Aucun vrai Valkey ni PostgreSQL n'est nécessaire à ces cinq tests techniques.

Arrêter les terminaux Django/worker avec `Ctrl+C`, puis arrêter uniquement le broker du projet :

```powershell
docker compose -f compose.valkey.yml stop valkey
```

Redémarrer avec `docker compose -f compose.valkey.yml start valkey`. Pour retirer les conteneurs/réseau de ce Compose en conservant le volume : `docker compose -f compose.valkey.yml down`. Ne pas ajouter `--volumes` si des messages doivent être conservés.

## Production et prochaine étape

Définir `DJANGO_SETTINGS_MODULE=config.settings.production` et `CELERY_BROKER_URL` dans l'environnement du déploiement, par exemple `redis://valkey:6379/0` sur son réseau privé. Les settings production refusent un broker absent ; aucun défaut localhost ni mode eager n'y est imposé. Ne pas publier le port du broker sur Internet. Configurer authentification/TLS selon l'infrastructure retenue, sans identifiants dans Git. Le petit Compose fourni est une configuration de développement local.

Aucun result backend n'est requis actuellement. Si un besoin apparaît, analyser sa rétention et utiliser une variable distincte `CELERY_RESULT_BACKEND` et une base logique dédiée, sans recycler arbitrairement celle du broker. L'implémentation des vraies tâches métier est le prochain lot ; publier après commit, par exemple via `transaction.on_commit`, en conservant les opérations financières et de stock critiques synchrones. [Intégration Django/Celery](https://docs.celeryq.dev/en/stable/django/first-steps-with-django.html).

Références de configuration : [transport Redis de Celery](https://docs.celeryq.dev/en/stable/getting-started/backends-and-brokers/redis.html), [image officielle Valkey et versions](https://valkey.io/download/).
