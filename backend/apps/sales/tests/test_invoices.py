from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from apps.accounts.models import RolePermission
from apps.companies.models import DocumentSequence
from apps.sales.models import Invoice, InvoiceLine, SalesOrder
from .support import SalesDataMixin


class InvoiceAPITests(SalesDataMixin, TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_login(self.user)
        quote = self.quote_input()
        self.payload = {key: quote[key] for key in ("customer_id", "salesperson", "billing_address", "currency", "payment_terms", "customer_reference")}
        self.payload.update(invoice_date=quote["issue_date"], due_date=quote["expires_at"], notes="Invoice notes",
                            lines=[{**quote["lines"][0], "product_name": "Consulting"}])

    def create(self, **changes):
        return self.client.post("/api/invoices/", {**self.payload, **changes}, format="json")

    def confirmed_order(self):
        data = {key: self.quote_input()[key] for key in ("customer_id", "salesperson", "currency", "payment_terms", "customer_reference", "billing_address", "lines")}
        response = self.client.post("/api/sales-orders/", data, format="json")
        self.assertEqual(response.status_code, 201)
        oid = response.data["id"]
        self.client.post(f"/api/sales-orders/{oid}/confirm/", {}, format="json")
        return oid

    def test_create_read_update_uses_decimal_totals_and_unavailable_capabilities(self):
        result = self.create()
        self.assertEqual(result.status_code, 201, result.data)
        invoice = Invoice.objects.get(pk=result.data["id"])
        self.assertEqual(invoice.total, Decimal("64.76"))
        self.assertEqual(invoice.balance_due, invoice.total)
        self.assertEqual(invoice.amount_paid, 0)
        self.assertEqual(result.data["workflowStatus"], "draft")
        self.assertIsNone(result.data["issuedAt"])
        self.assertEqual(result.data["lines"][0]["productName"], "Consulting")
        for key in ("canPost", "canSend", "canPay", "canRemind"):
            self.assertFalse(result.data["capabilities"][key])
        self.assertEqual(self.client.get(f"/api/invoices/{invoice.pk}/").status_code, 200)
        changed = self.client.patch(f"/api/invoices/{invoice.pk}/", {"notes": "Changed", "lines": [{**self.payload["lines"][0], "quantity": "2.000"}]}, format="json")
        self.assertEqual(changed.status_code, 200, changed.data)
        self.assertEqual(changed.data["totalAmount"], Decimal("43.18"))
        self.assertEqual(changed.data["balanceDue"], Decimal("43.18"))

    def test_names_without_description_and_patch_rows_are_validated(self):
        result = self.create(lines=[{**self.payload["lines"][0], "description": ""}])
        self.assertEqual(result.status_code, 201, result.data)
        iid = result.data["id"]
        self.assertEqual(self.client.patch(f"/api/invoices/{iid}/", {"lines": [{"product_name": "Incomplete"}]}, format="json").status_code, 400)
        self.assertEqual(self.create(lines=[]).status_code, 400)
        self.assertEqual(self.create(due_date="2000-01-01").status_code, 400)
        for field in ("total", "amount_paid", "balance_due", "status", "sales_order_id"):
            self.assertEqual(self.create(**{field: "1"}).status_code, 400)

    def test_invoice_from_order_is_atomic_full_copy_and_cannot_repeat(self):
        oid = self.confirmed_order()
        before = self.client.get(f"/api/sales-orders/{oid}/")
        self.assertTrue(before.data["capabilities"]["canInvoice"])
        self.assertEqual(self.client.post(f"/api/sales-orders/{oid}/invoice/", {"amount": "10.00"}, format="json").status_code, 400)
        created = self.client.post(f"/api/sales-orders/{oid}/invoice/", {"amount": "64.76"}, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        invoice = Invoice.objects.get(sales_order_id=oid)
        order = SalesOrder.objects.get(pk=oid)
        self.assertEqual(invoice.total, order.total)
        self.assertEqual(invoice.lines.get().quantity, order.lines.get().quantity)
        self.assertEqual(invoice.lines.get().tax_rate, order.lines.get().tax_rate)
        self.assertFalse(created.data["order"]["capabilities"]["canInvoice"])
        self.assertEqual(created.data["order"]["invoiceStatus"], "none")  # Draft is not posted revenue.
        self.assertEqual(created.data["order"]["invoices"][0]["status"], "draft")
        self.assertEqual(self.client.post(f"/api/sales-orders/{oid}/invoice/", {"amount": "64.76"}, format="json").status_code, 409)
        self.assertEqual(self.client.post(f"/api/sales-orders/{oid}/cancel/", {}, format="json").status_code, 409)
        self.assertEqual(self.client.patch(f"/api/invoices/{invoice.pk}/", {"notes": "Allowed"}, format="json").status_code, 200)
        self.assertEqual(self.client.patch(f"/api/invoices/{invoice.pk}/", {"lines": self.payload["lines"]}, format="json").status_code, 409)

    def test_unconfirmed_or_foreign_order_cannot_be_invoiced(self):
        oid = self.confirmed_order()
        SalesOrder.objects.filter(pk=oid).update(status="draft")
        self.assertEqual(self.client.post(f"/api/sales-orders/{oid}/invoice/", {"amount": "64.76"}, format="json").status_code, 409)
        SalesOrder.objects.filter(pk=oid).update(company=self.other_company, status="confirmed")
        self.assertEqual(self.client.post(f"/api/sales-orders/{oid}/invoice/", {"amount": "64.76"}, format="json").status_code, 404)

    def test_foreign_invoice_customer_and_tenant_payload_are_denied(self):
        self.assertEqual(self.create(customer_id=self.foreign_customer.pk).status_code, 404)
        iid = self.create().data["id"]
        Invoice.objects.filter(pk=iid).update(company=self.other_company)
        self.assertEqual(self.client.get(f"/api/invoices/{iid}/").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/invoices/{iid}/", {"notes": "Hack"}, format="json").status_code, 404)
        self.assertEqual(self.client.get(f"/api/invoices/?company_id={self.other_company.pk}").data["invoices"], [])
        self.assertEqual(self.create(company_id=self.other_company.pk).status_code, 403)

    def test_anonymous_and_missing_permissions(self):
        self.client.logout()
        self.assertEqual(self.client.get("/api/invoices/").status_code, 401)
        self.client.force_login(self.user)
        RolePermission.objects.filter(role=self.role, permission__code__startswith="invoices.").delete()
        self.assertEqual(self.client.get("/api/invoices/").status_code, 403)
        self.assertEqual(self.create().status_code, 403)

    def test_filter_pagination_aging_and_posted_invoice_are_read_only(self):
        first = self.create().data
        self.create()
        self.assertEqual(self.client.get("/api/invoices/?page_size=1").data["count"], 2)
        self.assertEqual(len(self.client.get("/api/invoices/?workflow=draft&search=Alpha&min_amount=60&max_amount=70").data["invoices"]), 2)
        self.assertEqual(sum(b["amount"] for b in self.client.get("/api/invoices/aging/").data), 0)
        # Existing/imported posted data can be read, but no posting action is implemented.
        yesterday = timezone.localdate() - timedelta(days=1)
        Invoice.objects.filter(pk=first["id"]).update(status="posted", issue_date=yesterday, due_date=yesterday)
        self.assertEqual(self.client.get("/api/invoices/?aging=1-30").data["count"], 1)
        self.assertEqual(sum(b["amount"] for b in self.client.get("/api/invoices/aging/").data), Decimal("64.76"))
        self.assertEqual(self.client.patch(f"/api/invoices/{first['id']}/", {"notes": "Immutable"}, format="json").status_code, 409)
        for action in ("post", "send", "payment", "remind", "credit-note"):
            self.assertEqual(self.client.post(f"/api/invoices/{first['id']}/{action}/", {}, format="json").status_code, 404)

    def test_late_failure_rolls_back_invoice_lines_number_and_order_link(self):
        oid = self.confirmed_order()
        with patch("apps.sales.invoice_services.InvoiceActivity.objects.create", side_effect=RuntimeError("failure")):
            with self.assertRaises(RuntimeError):
                self.client.post(f"/api/sales-orders/{oid}/invoice/", {"amount": "64.76"}, format="json")
        self.assertFalse(Invoice.objects.exists())
        self.assertFalse(InvoiceLine.objects.exists())
        self.assertFalse(DocumentSequence.objects.filter(kind="invoice").exists())
        self.assertEqual(self.client.post(f"/api/sales-orders/{oid}/invoice/", {"amount": "64.76"}, format="json").status_code, 201)

    def test_customer_360_uses_real_orders_invoices_and_posted_aggregates(self):
        oid = self.confirmed_order()
        self.client.post(f"/api/sales-orders/{oid}/invoice/", {"amount": "64.76"}, format="json")
        cid = self.customer.pk
        detail = self.client.get(f"/api/customers/{cid}/").data
        self.assertEqual(len(detail["sales"]), 1)
        self.assertEqual(len(detail["invoices"]), 1)
        self.assertEqual(detail["invoices"][0]["status"], "Draft")
        self.assertEqual(detail["revenue"], 0)
        self.assertIsNone(detail["sales"][0]["margin"])
        self.assertEqual(self.client.get(f"/api/customers/{cid}/summary/").data["totalOrders"], 1)
        self.assertTrue(any(e["type"] == "invoice" for e in self.client.get(f"/api/customers/{cid}/activity/").data))
        invoice = Invoice.objects.get(sales_order_id=oid)
        invoice.status = "posted"
        invoice.save()
        self.assertEqual(self.client.get(f"/api/customers/{cid}/summary/").data["revenue"], Decimal("64.76"))
        RolePermission.objects.filter(role=self.role, permission__code="invoices.view").delete()
        self.assertEqual(self.client.get(f"/api/customers/{cid}/").data["invoices"], [])
        self.assertFalse(any(e["type"] == "invoice" for e in self.client.get(f"/api/customers/{cid}/activity/").data))
