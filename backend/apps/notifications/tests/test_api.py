from django.test import TestCase
from apps.accounts.models import RolePermission
from apps.finance.tasks import scan_overdue_invoices
from apps.notifications.models import Notification
from apps.notifications.tasks import send_notification_email
from apps.sales.models import Invoice
from common.tests.async_support import AsyncDataMixin


class NotificationAPITests(AsyncDataMixin, TestCase):
    def test_list_read_and_permissions_revalidated(self):
        self.invoice(overdue=True)
        scan_overdue_invoices.run()
        obj = Notification.objects.get()
        response = self.client.get("/api/notifications/")
        self.assertEqual(response.data["unreadCount"], 1)
        self.assertEqual(self.post(f"/api/notifications/{obj.pk}/read/").status_code, 200)
        self.assertEqual(self.client.get("/api/notifications/").data["unreadCount"], 0)
        RolePermission.objects.filter(role=self.role, permission__code="invoices.view").delete()
        self.assertEqual(self.client.get("/api/notifications/").data["count"], 0)
        self.assertEqual(send_notification_email.run(obj.pk)["status"], "skipped")
        self.assertEqual(self.post(f"/api/notifications/{obj.pk}/read/").status_code, 404)

    def test_other_company_hidden_and_read_action_methods(self):
        invoice = self.invoice(overdue=True)
        Invoice.objects.filter(pk=invoice["id"]).update(company=self.other_company, customer=self.foreign_customer)
        scan_overdue_invoices.run()
        obj = Notification.objects.get()
        self.assertEqual(self.client.get("/api/notifications/").data["count"], 0)
        self.assertEqual(self.post("/api/notifications/read-all/").data["updated"], 0)
        self.assertEqual(self.post(f"/api/notifications/{obj.pk}/read/").status_code, 404)
        self.assertEqual(self.client.get("/api/notifications/read-all/").status_code, 405)
        self.assertEqual(self.post("/api/notifications/").status_code, 405)
