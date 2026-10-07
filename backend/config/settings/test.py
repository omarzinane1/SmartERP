from .base import *

# Unit tests execute tasks locally and must never connect to a real broker.
CELERY_BROKER_URL = "memory://"
# Celery reads this environment variable before its Django settings mapping.
# Isolate this test process even when the developer exported a real broker URL.
os.environ["CELERY_BROKER_URL"] = CELERY_BROKER_URL
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True


DEBUG = False


PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]
