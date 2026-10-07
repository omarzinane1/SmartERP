import os

from celery import Celery

# Same local default as manage.py; never override an explicitly selected module.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

app = Celery("smarterp")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
