from .base import *

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL") or "redis://localhost:6379/0"
EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL") or "noreply@smarterp.local"
EMAIL_ALLOW_CONSOLE = True


DEBUG = True

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL") or "http://localhost:11434"
OLLAMA_CHAT_MODEL = os.getenv("OLLAMA_CHAT_MODEL") or "qwen3:14b"
OLLAMA_EMBEDDING_MODEL = os.getenv("OLLAMA_EMBEDDING_MODEL") or "embeddinggemma:300m"


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
