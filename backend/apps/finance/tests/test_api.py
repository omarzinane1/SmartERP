from decimal import Decimal
from unittest.mock import patch
from django.test import TestCase
from django.utils import timezone
from apps.accounts.models import RolePermission
from apps.sales.models import Invoice
from apps.finance.models import Payment, PaymentAllocation
from .support import LedgerDataMixin


class PaymentTests(LedgerDataMixin, TestCase):
    def test_partial_then_full_and_cancellation_reverses_without_deleting(self):
        invoice = self.invoice()
        first = self.payment(invoice)
        self.assertEqual(first.status_code, 201, first.data)
        result = self.client.get(f"/api/invoices/{invoice['id']}/").data
        self.assertEqual((result["paidAmount"], result["balanceDue"], result["paymentStatus"]), (400, 600, "partially_paid"))
        self.assertEqual(self.payment(invoice, amount="600.00").status_code, 201)
        result = self.client.get(f"/api/invoices/{invoice['id']}/").data
        self.assertEqual((result["paidAmount"], result["balanceDue"], result["paymentStatus"]), (1000, 0, "paid"))
        cancelled = self.post(f"/api/payments/{first.data['id']}/cancel/")
        self.assertEqual(cancelled.status_code, 200, cancelled.data)
        self.assertEqual(Invoice.objects.get(pk=invoice["id"]).balance_due, 400)
        self.assertEqual(PaymentAllocation.objects.count(), 2)
        self.assertEqual(PaymentAllocation.objects.filter(reversed_at__isnull=False).count(), 1)
        self.assertEqual(self.post(f"/api/payments/{first.data['id']}/cancel/").status_code, 409)

    def test_one_payment_multiple_invoices_and_allocation_rules(self):
        first, second = self.invoice(), self.invoice()
        payment = self.payment(amount="1500.00")
        self.assertEqual(payment.status_code, 201, payment.data)
        path = f"/api/payments/{payment.data['id']}/allocate/"
        allocation = dict(invoice_id=first["id"], amount="1000.00")
        self.assertEqual(self.post(path, allocation, "allocation-repeat-1").status_code, 200)
        self.assertEqual(self.post(path, allocation, "allocation-repeat-1").status_code, 200)
        self.assertEqual(self.post(path, dict(invoice_id=second["id"], amount="600.00")).status_code, 409)
        self.assertEqual(self.post(path, dict(invoice_id=second["id"], amount="-1.00")).status_code, 400)
        result = self.post(path, dict(invoice_id=second["id"], amount="500.00"))
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(len(result.data["allocations"]), 2)
        self.assertIsNone(result.data["invoiceId"])
        self.assertEqual(result.data["availableAmount"], 0)
        self.post(f"/api/payments/{payment.data['id']}/cancel/")
        self.assertEqual(self.post(path, dict(invoice_id=second["id"], amount="1.00")).status_code, 409)

    def test_payment_idempotency_filters_summary_and_invalid_input(self):
        data = dict(direction="incoming", partner_id=self.customer.pk, amount="25.00", date=timezone.localdate().isoformat(), method="cash")
        one = self.post("/api/payments/", data, "payment-repeat-1")
        self.assertEqual(one.status_code, 201, one.data)
        self.assertEqual(self.post("/api/payments/", data, "payment-repeat-1").data["id"], one.data["id"])
        self.assertEqual(self.post("/api/payments/", {**data, "amount": "26"}, "payment-repeat-1").status_code, 409)
        self.assertEqual(self.client.get("/api/payments/?method=cash&direction=incoming&page_size=1").data["count"], 1)
        self.assertEqual(self.client.get("/api/payments/?min_amount=26").data["count"], 0)
        self.assertEqual(self.client.get("/api/payments/summary/").data["received"], 25)
        for extra in ({"amount": "0"}, {"amount": "1.001"}, {"currency": "EUR"}, {"status": "completed"}):
            self.assertEqual(self.post("/api/payments/", {**data, **extra}).status_code, 400)
        self.assertEqual(self.client.post("/api/payments/", data, format="json").status_code, 400)

    def test_cross_company_resources_permissions_and_superuser_no_bypass(self):
        invoice = self.invoice()
        payment = self.payment().data
        Invoice.objects.filter(pk=invoice["id"]).update(company=self.other_company)
        for action in ("post", "remind", "credit-note", "payment"):
            self.assertEqual(self.post(f"/api/invoices/{invoice['id']}/{action}/").status_code, 404)
        self.assertEqual(self.post(f"/api/payments/{payment['id']}/allocate/", dict(invoice_id=invoice["id"], amount="1.00")).status_code, 404)
        Payment.objects.filter(pk=payment["id"]).update(company=self.other_company)
        self.assertEqual(self.client.get(f"/api/payments/{payment['id']}/").status_code, 404)
        self.assertEqual(self.post(f"/api/payments/{payment['id']}/cancel/").status_code, 404)
        self.assertEqual(self.client.get("/api/payments/").data["count"], 0)
        self.user.is_superuser = True
        self.user.save()
        RolePermission.objects.filter(role=self.role, permission__code__startswith="payments.").delete()
        self.assertEqual(self.client.get("/api/payments/").status_code, 403)
        self.assertEqual(self.payment().status_code, 403)

    def test_overallocation_and_late_failure_rollback_all_objects(self):
        invoice = self.invoice()
        self.assertEqual(self.payment(invoice, amount="1000.01").status_code, 409)
        self.assertFalse(Payment.objects.exists())
        with patch("apps.finance.services.invoice_activity", side_effect=RuntimeError("failure")):
            with self.assertRaises(RuntimeError):
                self.payment(invoice)
        self.assertFalse(Payment.objects.exists())
        self.assertFalse(PaymentAllocation.objects.exists())
        self.assertEqual(Invoice.objects.get(pk=invoice["id"]).amount_paid, 0)

    def test_currency_partner_and_draft_allocation_rejected(self):
        invoice = self.invoice(posted=False)
        self.assertEqual(self.payment(invoice).status_code, 409)
        self.post(f"/api/invoices/{invoice['id']}/post/")
        Invoice.objects.filter(pk=invoice["id"]).update(currency="EUR")
        self.assertEqual(self.payment(invoice).status_code, 400)
