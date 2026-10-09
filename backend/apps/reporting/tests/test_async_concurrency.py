from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch
from django.db import connections
from django.test import TransactionTestCase
from apps.accounts.models import User, Membership, Role, MembershipRole, Permission, RolePermission
from apps.companies.models import Company
from apps.inventory.models import Product
from apps.notifications.models import Notification
from apps.notifications.services import create_notification
from apps.notifications.tasks import send_notification_email
from apps.reporting.job_services import claim_job, request_job
from apps.reporting.models import AsyncJob
from apps.reporting.tasks import generate_report_export
from common.email_delivery import claim_delivery


class AsyncConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.company = Company.objects.create(name="Concurrent async")
        self.user = User.objects.create_user(email="async@example.test")
        self.member = Membership.objects.create(company=self.company, user=self.user)
        role = Role.objects.create(company=self.company, name="Async", code="async")
        MembershipRole.objects.create(membership=self.member, role=role)
        for code in ["reports.view", "reports.generate", "reports.export", "customers.view", "customers.export", "products.view"]:
            permission, _ = Permission.objects.get_or_create(code=code, defaults=dict(label=code, module=code.split('.')[0], action=code.split('.')[1]))
            RolePermission.objects.create(role=role, permission=permission)
        self.product = Product.objects.create(company=self.company, reference="CONCURRENT", name="Concurrent")

    def race(self, action):
        barrier = Barrier(2)
        def work(_):
            try:
                barrier.wait(timeout=10)
                return action()
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            return list(pool.map(work, range(2)))

    def notification(self):
        return create_notification(company=self.company, recipient_id=self.user.pk, type="notification", title="Stock", message="Stock",
            entity_type="product", entity_id=self.product.pk, dedupe_key="same-event", permissions=["products.view"])

    def test_concurrent_notifications_create_one_row_and_one_publication(self):
        with patch.object(send_notification_email, "apply_async") as publish:
            results = self.race(lambda: self.notification()[1])
            self.assertEqual(sorted(results), [False, True])
            publish.assert_called_once()
        self.assertEqual(Notification.objects.count(), 1)

    def test_concurrent_email_claims_have_one_sender(self):
        with patch.object(send_notification_email, "apply_async"):
            obj, _ = self.notification()
        results = self.race(lambda: claim_delivery("notification", obj.pk)[0] is not None)
        self.assertEqual(sorted(results), [False, True])
        self.assertEqual(Notification.objects.get().email_attempts, 1)

    def test_concurrent_idempotent_requests_and_claims(self):
        with patch.object(generate_report_export, "apply_async") as publish:
            ids = self.race(lambda: request_job(company=self.company, membership=self.member, data=dict(report_id="customers", format="csv"), key="same-job-request").pk)
            self.assertEqual(ids[0], ids[1])
            publish.assert_called_once()
        results = self.race(lambda: claim_job(ids[0], "report_export")[0] is not None)
        self.assertEqual(sorted(results), [False, True])
        self.assertEqual(AsyncJob.objects.get().attempts, 1)
