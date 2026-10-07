from .base import *

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL") or "redis://localhost:6379/0"


DEBUG = True


ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
]


CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
]


CORS_ALLOW_CREDENTIALS = True


CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
]
