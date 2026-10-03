from datetime import timedelta
from uuid import uuid4
from django.utils import timezone
from rest_framework.test import APIClient
from apps.accounts.models import Permission, RolePermission
from apps.sales.tests.support import SalesDataMixin


class LedgerDataMixin(SalesDataMixin):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        for code in ("invoices.post", "invoices.credit_note", "invoices.remind", "payments.view", "payments.create", "payments.cancel",
                     "suppliers.view", "suppliers.create", "suppliers.edit", "purchases.view", "purchases.create", "purchases.edit", "purchases.confirm", "receipts.create"):
            RolePermission.objects.get_or_create(role=cls.role, permission=Permission.objects.get(code=code))

    def setUp(self):
        self.client = APIClient()
        self.client.force_login(self.user)

    def post(self, path, data=None, key=None):
        return self.client.post(path, data or {}, format="json", HTTP_IDEMPOTENCY_KEY=key or str(uuid4()))

    def invoice(self, posted=True, overdue=False, price="100.00", quantity="10.000", tax="0.00"):
        today = timezone.localdate()
        result = self.post("/api/invoices/", dict(customer_id=self.customer.pk, billing_address="Rabat", salesperson="RBAC Tester",
            invoice_date=(today - timedelta(days=10)).isoformat(), due_date=(today - timedelta(days=1) if overdue else today + timedelta(days=10)).isoformat(),
            currency="MAD", payment_terms="10 jours", customer_reference="", notes="",
            lines=[dict(product_id=None, product_name="Service", description="", quantity=quantity, unit_price=price, discount_rate="0.00", tax_rate=tax)]))
        self.assertEqual(result.status_code, 201, result.data)
        if posted:
            result = self.post(f"/api/invoices/{result.data['id']}/post/")
            self.assertEqual(result.status_code, 200, result.data)
        return result.data

    def payment(self, invoice=None, amount="400.00", **changes):
        return self.post("/api/payments/", dict(direction="incoming", partner_id=self.customer.pk,
            invoice_id=invoice["id"] if invoice else None, amount=amount, date=timezone.localdate().isoformat(),
            method="bank_transfer", reference_external="", note="", **changes))
