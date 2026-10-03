from decimal import Decimal
from unittest.mock import patch
from django.test import TestCase
from django.utils import timezone
from apps.accounts.models import RolePermission
from apps.finance.tests.support import LedgerDataMixin
from apps.sales.models import CreditNote, Invoice, InvoiceActivity, InvoiceReminder


class InvoiceWorkflowTests(LedgerDataMixin, TestCase):
    def test_post_recomputes_decimal_locks_and_numbers(self):
        data = self.invoice(posted=False, price="19.99", quantity="3.000", tax="20.00")
        invoice = Invoice.objects.get(pk=data["id"])
        invoice.lines.update(line_total=1, tax_total=0)
        result = self.post(f"/api/invoices/{invoice.pk}/post/")
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data["totalAmount"], Decimal("71.96"))
        self.assertEqual(result.data["reference"], data["reference"])
        self.assertIsNotNone(result.data["issuedAt"])
        self.assertEqual(self.post(f"/api/invoices/{invoice.pk}/post/").status_code, 409)
        self.assertEqual(self.client.patch(f"/api/invoices/{invoice.pk}/", {"notes": "x"}, format="json").status_code, 409)

    def test_post_empty_foreign_and_no_permission(self):
        iid = self.invoice(posted=False)["id"]
        Invoice.objects.get(pk=iid).lines.all().delete()
        self.assertEqual(self.post(f"/api/invoices/{iid}/post/").status_code, 409)
        Invoice.objects.filter(pk=iid).update(company=self.other_company)
        self.assertEqual(self.post(f"/api/invoices/{iid}/post/").status_code, 404)
        RolePermission.objects.filter(role=self.role, permission__code="invoices.post").delete()
        self.assertEqual(self.post(f"/api/invoices/{iid}/post/").status_code, 403)

    def credit(self, invoice, **changes):
        return self.post(f"/api/invoices/{invoice['id']}/credit-note/", dict(date=timezone.localdate().isoformat(), reason="Retour", **changes))

    def test_full_credit_financial_state_and_immutable(self):
        invoice = self.invoice()
        result = self.credit(invoice)
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data["creditTotal"], Decimal("1000.00"))
        self.assertEqual(result.data["balanceDue"], 0)
        self.assertEqual(result.data["paidAmount"], 0)
        self.assertEqual(self.credit(invoice).status_code, 409)
        self.assertEqual(CreditNote.objects.count(), 1)

    def test_partial_credits_preserve_rounding_and_idempotency(self):
        invoice = self.invoice(price="0.05", quantity="3.000", tax="10.00")
        path = f"/api/invoices/{invoice['id']}/credit-note/"
        payload = dict(date=timezone.localdate().isoformat(), reason="Retour", lines=[dict(line_id=invoice["lines"][0]["id"], quantity="1.000")])
        first = self.post(path, payload, "credit-repeat-123")
        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(self.post(path, payload, "credit-repeat-123").status_code, 200)
        self.assertEqual(CreditNote.objects.count(), 1)
        self.assertEqual(self.post(path, {**payload, "reason": "Changed"}, "credit-repeat-123").status_code, 409)
        self.assertEqual(self.post(path, payload).status_code, 200)
        result = self.post(path, payload)
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data["balanceDue"], 0)
        self.assertEqual(result.data["creditTotal"], Decimal("0.17"))

    def test_credit_rejects_excess_foreign_lines_and_draft(self):
        draft = self.invoice(posted=False)
        self.assertEqual(self.credit(draft).status_code, 409)
        invoice = self.invoice()
        self.assertEqual(self.credit(invoice, lines=[dict(line_id=draft["lines"][0]["id"], quantity=1)]).status_code, 404)
        self.assertEqual(self.credit(invoice, lines=[dict(line_id=invoice["lines"][0]["id"], quantity=11)]).status_code, 409)
        self.assertEqual(self.payment(invoice).status_code, 201)
        self.assertEqual(self.credit(invoice).status_code, 409)
        self.assertEqual(self.credit(invoice, total=1).status_code, 400)
        RolePermission.objects.filter(role=self.role, permission__code="invoices.credit_note").delete()
        self.assertEqual(self.credit(invoice).status_code, 403)

    def test_overdue_reminder_aging_and_permissions(self):
        invoice = self.invoice(overdue=True)
        self.assertTrue(invoice["overdue"])
        self.assertFalse(self.invoice()["overdue"])
        result = self.post(f"/api/invoices/{invoice['id']}/remind/", key="reminder-repeat-1")
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data["reminders"][0]["status"], "requested")
        self.post(f"/api/invoices/{invoice['id']}/remind/", key="reminder-repeat-1")
        self.assertEqual(InvoiceReminder.objects.count(), 1)
        aging = self.client.get("/api/invoices/aging/").data
        self.assertEqual(next(b for b in aging if b["key"] == "1-30")["amount"], 1000)
        self.payment(invoice, amount="1000.00")
        result = self.client.get(f"/api/invoices/{invoice['id']}/")
        self.assertFalse(result.data["overdue"])
        self.assertEqual(self.post(f"/api/invoices/{invoice['id']}/remind/").status_code, 409)
        RolePermission.objects.filter(role=self.role, permission__code="invoices.remind").delete()
        self.assertEqual(self.post(f"/api/invoices/{invoice['id']}/remind/").status_code, 403)

    def test_credit_rollback_on_late_failure(self):
        invoice = self.invoice()
        with patch("apps.sales.invoice_workflows.invoice_activity", side_effect=RuntimeError("failure")):
            with self.assertRaises(RuntimeError):
                self.credit(invoice)
        self.assertFalse(CreditNote.objects.exists())
        self.assertEqual(Invoice.objects.get(pk=invoice["id"]).credit_total, 0)
