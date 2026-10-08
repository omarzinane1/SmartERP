from unittest.mock import patch
from django.test import TestCase
from apps.notifications.models import Notification
from apps.sales.models import Invoice
from common.tests.async_support import AsyncDataMixin
from apps.finance.tasks import scan_overdue_invoices


class OverdueScanTests(AsyncDataMixin, TestCase):
    def test_overdue_flow_and_repeated_scan_no_duplicate(self):
        late = self.invoice(overdue=True)
        self.invoice()
        self.invoice(posted=False, overdue=True)
        paid = self.invoice(overdue=True)
        self.payment(paid, amount="1000.00")
        first = scan_overdue_invoices.run()
        self.assertEqual(first["created"], 1)
        notice = Notification.objects.get()
        self.assertEqual((notice.company_id, notice.entity_id, notice.recipient_id), (self.company.pk, late["id"], self.user.pk))
        self.assertEqual(scan_overdue_invoices.run()["created"], 0)
        self.assertEqual(Invoice.objects.get(pk=late["id"]).status, "posted")

    def test_company_isolation_inactive_and_corrupt_relation(self):
        first, second, corrupt = [self.invoice(overdue=True) for _ in range(3)]
        Invoice.objects.filter(pk=second["id"]).update(company=self.other_company, customer=self.foreign_customer)
        Invoice.objects.filter(pk=corrupt["id"]).update(customer=self.foreign_customer)
        self.assertEqual(scan_overdue_invoices.run()["created"], 2)
        self.assertEqual(set(Notification.objects.values_list("company_id", "entity_id")), {(self.company.pk, first["id"]), (self.other_company.pk, second["id"])})
        self.other_company.is_active = False
        self.other_company.save()
        self.assertEqual(scan_overdue_invoices.run()["companies"], 1)

    def test_company_failure_does_not_stop_next_company(self):
        with patch("apps.finance.tasks.notify_overdue_company", side_effect=[RuntimeError("private details"), 1]):
            with self.assertLogs("common.scans", level="INFO") as logs:
                result = scan_overdue_invoices.run()
        self.assertEqual(result, dict(companies=2, created=1, failed=1))
        self.assertNotIn("private details", " ".join(logs.output))
