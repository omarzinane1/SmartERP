import logging
from celery import shared_task
from django.utils import timezone
from .models import IdempotencyKey

logger = logging.getLogger(__name__)


@shared_task
def cleanup_expired_idempotency_keys():
    cutoff, deleted = timezone.now(), 0
    logger.info("idempotency_cleanup_started")
    while True:
        ids = list(IdempotencyKey.objects.filter(expires_at__lt=cutoff).order_by("pk").values_list("pk", flat=True)[:500])
        if not ids:
            break
        # Recheck expiry at deletion, including keys renewed concurrently.
        _, counts = IdempotencyKey.objects.filter(pk__in=ids, expires_at__lt=cutoff).delete()
        deleted += counts.get(IdempotencyKey._meta.label, 0)
    logger.info("idempotency_cleanup_completed deleted=%s", deleted)
    return dict(deleted=deleted)
