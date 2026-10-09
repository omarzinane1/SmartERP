import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]

load_dotenv(BASE_DIR / ".env")


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError("DJANGO_SECRET_KEY is not configured.")


DEBUG = False

ALLOWED_HOSTS = []


INSTALLED_APPS = [
    # Django
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party
    "rest_framework",
    "corsheaders",

    # SmartERP
    "apps.accounts.apps.AccountsConfig",
    "apps.companies.apps.CompaniesConfig",
    "apps.inventory.apps.InventoryConfig",
    "apps.crm.apps.CrmConfig",
    "apps.sales.apps.SalesConfig",
    "apps.purchasing.apps.PurchasingConfig",
    "apps.finance.apps.FinanceConfig",
    "apps.approvals.apps.ApprovalsConfig",
    "apps.documents.apps.DocumentsConfig",
    "apps.reporting.apps.ReportingConfig",
    "apps.audit.apps.AuditConfig",
    "apps.notifications.apps.NotificationsConfig",
]


MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",

    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",

    "django.contrib.auth.middleware.AuthenticationMiddleware",

    # SmartERP multi-company context
    "common.middleware.CompanyContextMiddleware",

    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


ROOT_URLCONF = "config.urls"


TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [
            BASE_DIR / "templates",
        ],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"


DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME"),
        "USER": os.getenv("DB_USER"),
        "PASSWORD": os.getenv("DB_PASSWORD"),
        "HOST": os.getenv("DB_HOST", "127.0.0.1"),
        "PORT": os.getenv("DB_PORT", "5433"),
        "CONN_MAX_AGE": 60,
    }
}


AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "UserAttributeSimilarityValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "MinimumLengthValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "CommonPasswordValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "NumericPasswordValidator"
        ),
    },
]


LANGUAGE_CODE = "fr-fr"

TIME_ZONE = "Africa/Casablanca"

USE_I18N = True

USE_TZ = True


STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"


DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"


REST_FRAMEWORK = {
    "EXCEPTION_HANDLER": "common.exceptions.exception_handler",
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "common.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}


SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"

CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = "Lax"

# Valkey is a Redis-compatible Celery broker, not an ERP data store.
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL")
CELERY_TASK_SERIALIZER = "json"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_IGNORE_RESULT = True
CELERY_TASK_ALWAYS_EAGER = False
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
CELERY_TASK_DEFAULT_QUEUE = "smarterp"
# common is infrastructure, not an installed Django business app.
CELERY_IMPORTS = ("common.tasks",)
CELERY_BROKER_CONNECTION_TIMEOUT = 3
CELERY_BROKER_TRANSPORT_OPTIONS = {"socket_connect_timeout": 3, "socket_timeout": 3}

# Outbound email is opt-in. Tests use locmem, never a real SMTP server.
EMAIL_DELIVERY_ENABLED = os.getenv("EMAIL_DELIVERY_ENABLED", "false").lower() == "true"
EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = os.getenv("EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "true").lower() == "true"
EMAIL_USE_SSL = os.getenv("EMAIL_USE_SSL", "false").lower() == "true"
EMAIL_TIMEOUT = 15
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "")
EMAIL_DELIVERY_TEST_MODE = False
EMAIL_ALLOW_CONSOLE = False

# Opt-in Beat schedule, interpreted in CELERY_TIMEZONE (Africa/Casablanca).
CELERY_BEAT_SCHEDULE = {}
if os.getenv("CELERY_BEAT_ENABLED", "false").lower() == "true":
    from celery.schedules import crontab
    CELERY_BEAT_SCHEDULE = {
        "overdue-daily": {"task": "apps.finance.tasks.scan_overdue_invoices", "schedule": crontab(hour=7, minute=0)},
        "stock-daily": {"task": "apps.inventory.tasks.scan_low_stock", "schedule": crontab(hour=8, minute=0)},
        "idempotency-nightly": {"task": "apps.audit.tasks.cleanup_expired_idempotency_keys", "schedule": crontab(hour=2, minute=0)},
        "interrupted-tasks-hourly": {"task": "apps.reporting.tasks.expire_stalled_jobs", "schedule": crontab(minute=15)},
    }
