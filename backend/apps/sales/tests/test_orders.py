from unittest.mock import patch
from django.test import TestCase
from rest_framework.test import APIClient
from apps.accounts.models import RolePermission
from apps.companies.models import DocumentSequence
from apps.sales.models import Quote, SalesOrder, SalesOrderActivity, SalesOrderLine
from .support import SalesDataMixin


class SalesOrderAPITests(SalesDataMixin, TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_login(self.user)
        self.order_input = {key: self.quote_input()[key] for key in ("customer_id", "salesperson", "currency", "payment_terms", "customer_reference", "billing_address", "lines")}

    def create(self, **changes):
        return self.client.post("/api/sales-orders/", {**self.order_input, **changes}, format="json")

    def action(self, order_id, action):
        return self.client.post(f"/api/sales-orders/{order_id}/{action}/", {}, format="json")

    def accepted_quote(self):
        response = self.client.post("/api/quotes/", self.quote_input(), format="json")
        self.assertEqual(response.status_code, 201)
        qid = response.data["id"]
        self.client.post(f"/api/quotes/{qid}/send/", {}, format="json")
        self.client.post(f"/api/quotes/{qid}/accept/", {}, format="json")
        return qid

    def test_conversion_copies_exact_snapshot_and_is_unique(self):
        qid = self.accepted_quote()
        response = self.client.post(f"/api/quotes/{qid}/convert/", {"target": "sales_order"}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        order = SalesOrder.objects.get(pk=response.data["id"])
        quote = Quote.objects.get(pk=qid)
        self.assertEqual(order.quote_id, qid)
        self.assertEqual(order.customer_id, quote.customer_id)
        for field in ("gross_total", "discount_total", "subtotal", "tax_total", "total"):
            self.assertEqual(getattr(order, field), getattr(quote, field))
        original, copied = quote.lines.get(), order.lines.get()
        for field in ("product_id", "description", "quantity", "unit_price", "discount_rate", "tax_rate", "line_total"):
            self.assertEqual(getattr(original, field), getattr(copied, field))
        self.assertEqual(self.client.post(f"/api/quotes/{qid}/convert/", {"target": "sales_order"}, format="json").status_code, 409)
        self.assertEqual(SalesOrder.objects.filter(quote_id=qid).count(), 1)
        detail = self.client.get(f"/api/quotes/{qid}/").data
        self.assertEqual(detail["converted_to"]["id"], order.pk)
        self.assertEqual(detail["conversion_targets"], [])

    def test_conversion_requires_acceptance_and_valid_target(self):
        draft = self.client.post("/api/quotes/", self.quote_input(), format="json").data["id"]
        self.assertEqual(self.client.post(f"/api/quotes/{draft}/convert/", {}, format="json").status_code, 409)
        self.assertEqual(self.client.post(f"/api/quotes/{draft}/convert/", {"target": "invoice"}, format="json").status_code, 400)
        self.assertEqual(SalesOrder.objects.count(), 0)

    def test_conversion_rolls_back_order_lines_and_sequence_on_late_failure(self):
        qid = self.accepted_quote()
        with patch("apps.sales.order_services.SalesOrderActivity.objects.create", side_effect=RuntimeError("failure")):
            with self.assertRaises(RuntimeError):
                self.client.post(f"/api/quotes/{qid}/convert/", {}, format="json")
        self.assertFalse(SalesOrder.objects.exists())
        self.assertFalse(SalesOrderLine.objects.exists())
        self.assertFalse(DocumentSequence.objects.filter(kind="sales_order").exists())
        self.assertEqual(self.client.post(f"/api/quotes/{qid}/convert/", {}, format="json").status_code, 201)

    def test_create_read_update_filter_and_validation(self):
        response = self.create()
        self.assertEqual(response.status_code, 201, response.data)
        oid = response.data["id"]
        self.assertEqual(response.data["orderStatus"], "draft")
        self.assertEqual(response.data["totals"]["total"], response.data["totalAmount"])
        self.assertIsNone(response.data["lines"][0]["unitCost"])
        self.assertFalse(response.data["capabilities"]["canDeliver"])
        self.assertEqual(self.client.get(f"/api/sales-orders/{oid}/").status_code, 200)
        updated = self.client.patch(f"/api/sales-orders/{oid}/", {"customer_reference": "NEW"}, format="json")
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["customerReference"], "NEW")
        self.create()
        self.assertEqual(self.client.get("/api/sales-orders/?page_size=1").data["count"], 2)
        self.assertEqual(self.client.get("/api/sales-orders/?search=Alpha&status=draft").data["count"], 2)
        self.assertEqual(self.client.get("/api/sales-orders/?delivery_status=delivered").data["orders"], [])
        self.assertEqual(self.create(lines=[]).status_code, 400)
        self.assertEqual(self.create(total=1).status_code, 400)
        self.assertEqual(self.client.patch(f"/api/sales-orders/{oid}/", {"status": "completed"}, format="json").status_code, 400)

    def test_confirmation_processing_cancel_and_invalid_transitions(self):
        oid = self.create().data["id"]
        self.assertEqual(self.action(oid, "processing").status_code, 409)
        confirmed = self.action(oid, "confirm")
        self.assertEqual(confirmed.data["orderStatus"], "confirmed")
        self.assertIsNotNone(confirmed.data["confirmedAt"])
        self.assertEqual(self.action(oid, "confirm").status_code, 409)
        self.assertEqual(self.action(oid, "processing").data["orderStatus"], "processing")
        self.assertEqual(self.action(oid, "cancel").status_code, 409)
        self.assertEqual(self.client.patch(f"/api/sales-orders/{oid}/", {"notes": "Changed"}, format="json").status_code, 409)
        cancelled = self.create().data["id"]
        self.assertEqual(self.action(cancelled, "cancel").data["orderStatus"], "cancelled")
        self.assertEqual(self.action(cancelled, "confirm").status_code, 409)

    def test_foreign_order_quote_customer_and_payload_are_denied(self):
        self.assertEqual(self.create(customer_id=self.foreign_customer.pk).status_code, 404)
        oid = self.create().data["id"]
        SalesOrder.objects.filter(pk=oid).update(company=self.other_company)
        for method in (self.client.get, self.client.patch):
            self.assertEqual(method(f"/api/sales-orders/{oid}/", {}, format="json").status_code, 404)
        self.assertEqual(self.action(oid, "confirm").status_code, 404)
        self.assertEqual(self.client.get(f"/api/sales-orders/?company_id={self.other_company.pk}").data["orders"], [])
        qid = self.accepted_quote()
        Quote.objects.filter(pk=qid).update(company=self.other_company)
        self.assertEqual(self.client.post(f"/api/quotes/{qid}/convert/", {}, format="json").status_code, 404)
        self.assertEqual(self.create(company_id=self.other_company.pk).status_code, 403)

    def test_anonymous_and_missing_business_permissions(self):
        self.client.logout()
        self.assertEqual(self.client.get("/api/sales-orders/").status_code, 401)
        self.client.force_login(self.user)
        RolePermission.objects.filter(role=self.role, permission__code__in=["sales.view", "sales.edit"]).delete()
        self.assertEqual(self.client.get("/api/sales-orders/").status_code, 403)
        self.assertEqual(self.create().status_code, 403)

    def test_transition_rolls_back_on_failure(self):
        oid = self.create().data["id"]
        with patch.object(SalesOrderActivity.objects, "create", side_effect=RuntimeError("failure")):
            with self.assertRaises(RuntimeError):
                self.action(oid, "confirm")
        order = SalesOrder.objects.get(pk=oid)
        self.assertEqual(order.status, "draft")
        self.assertIsNone(order.confirmed_at)
