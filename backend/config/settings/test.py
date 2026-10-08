from .base import *

# Unit tests execute tasks locally and must never connect to a real broker.
CELERY_BROKER_URL = "memory://"
# Celery reads this environment variable before its Django settings mapping.
# Isolate this test process even when the developer exported a real broker URL.
os.environ["CELERY_BROKER_URL"] = CELERY_BROKER_URL
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
EMAIL_DELIVERY_TEST_MODE = True
EMAIL_DELIVERY_ENABLED = False
DEFAULT_FROM_EMAIL = "notifications@example.test"
CELERY_BEAT_SCHEDULE = {}


DEBUG = False


PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]
