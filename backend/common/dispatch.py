"""Bounded, post-commit publication. PostgreSQL records remain authoritative."""
import logging
from functools import partial
from django.db import transaction
from kombu.exceptions import OperationalError

logger = logging.getLogger(__name__)


def _publish(task, object_id, failed):
    try:
        task.apply_async(args=[object_id], retry=False)
    except (OperationalError, OSError) as error:
        logger.error("task_publish_failed task=%s object_id=%s error_type=%s", task.name, object_id, type(error).__name__)
        failed()


def enqueue_after_commit(task, object_id, *, failed):
    transaction.on_commit(partial(_publish, task, object_id, failed), robust=True)
