"""Technical diagnostics only; no business operations are dispatched here."""
from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


@shared_task(ignore_result=True)
def celery_healthcheck():
    logger.info("SmartERP Celery healthcheck: ok")
    return "ok"
