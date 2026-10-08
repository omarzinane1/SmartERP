from datetime import timedelta
from unittest.mock import patch
from django.test import TestCase
from django.utils import timezone
from apps.audit.models import IdempotencyKey
from apps.audit.tasks import cleanup_expired_idempotency_keys
from apps.accounts.tests.support import RBACDataMixin


class CleanupTests(RBACDataMixin, TestCase):
    def test_expired_active_permanent_boundary_and_count(self):
        now = timezone.now()
        for index, expires in enumerate([now-timedelta(seconds=1), now, now+timedelta(days=1), None]):
            IdempotencyKey.objects.create(company=self.company, actor=self.user, operation="async_job", key=f"test-key-{index}",
                request_hash="x", response_code=202, response_body={}, expires_at=expires)
        with patch("apps.audit.tasks.timezone.now", return_value=now):
            self.assertEqual(cleanup_expired_idempotency_keys.run(), {"deleted": 1})
            self.assertEqual(cleanup_expired_idempotency_keys.run(), {"deleted": 0})
        self.assertEqual(set(IdempotencyKey.objects.values_list("key", flat=True)), {"test-key-1", "test-key-2", "test-key-3"})

    def test_chunked_cleanup_more_than_one_batch(self):
        IdempotencyKey.objects.bulk_create([IdempotencyKey(company=self.company, actor=self.user, operation="async_job", key=str(index),
            request_hash="x", response_code=202, response_body={}, expires_at=timezone.now()-timedelta(days=1)) for index in range(503)])
        self.assertEqual(cleanup_expired_idempotency_keys.run()["deleted"], 503)
