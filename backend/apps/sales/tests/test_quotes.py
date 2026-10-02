from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from apps.accounts.models import RolePermission
from apps.companies.models import DocumentSequence
from apps.inventory.models import Product
from apps.sales.models import Quote, QuoteActivity, QuoteLine
from .support import SalesDataMixin


class QuoteAPITests(SalesDataMixin, TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_login(self.user)

    def create(self, **changes):
        return self.client.post("/api/quotes/", {**self.quote_input(), **changes}, format="json")

    def action(self, quote_id, action):
        return self.client.post(f"/api/quotes/{quote_id}/{action}/", {}, format="json")

    def test_create_read_update_and_decimal_totals_match_frontend(self):
        result = self.create()
        self.assertEqual(result.status_code, 201, result.data)
        quote = Quote.objects.get(pk=result.data["id"])
        self.assertEqual(quote.gross_total, Decimal("59.97"))
        self.assertEqual(quote.discount_total, Decimal("6.00"))
        self.assertEqual(quote.subtotal, Decimal("53.97"))
        self.assertEqual(quote.tax_total, Decimal("10.79"))
        self.assertEqual(quote.total, Decimal("64.76"))
        self.assertEqual(result.data["lines"][0]["unit_price"], "19.99")
        self.assertEqual(self.client.get(f"/api/quotes/{quote.pk}/").status_code, 200)
        line = dict(product_id=None, description="Rounding", quantity="0.005", unit_price="1.00", discount_rate="50.00", tax_rate="20.00")
        changed = self.client.patch(f"/api/quotes/{quote.pk}/", {"lines": [line]}, format="json")
        self.assertEqual(changed.status_code, 200, changed.data)
        self.assertEqual(changed.data["total_amount"], "0.00")
        persisted = QuoteLine.objects.get(quote=quote)
        self.assertEqual(persisted.gross_total, Decimal("0.01"))
        self.assertEqual(persisted.discount_total, Decimal("0.01"))

    def test_no_client_totals_status_negative_or_incomplete_lines(self):
        self.assertEqual(self.create(total_amount="1").status_code, 400)
        self.assertEqual(self.create(status="accepted").status_code, 400)
        for field, value in [("quantity", "0"), ("unit_price", "-1"), ("discount_rate", "101"), ("tax_rate", "NaN")]:
            line = {**self.quote_input()["lines"][0], field: value}
            self.assertEqual(self.create(lines=[line]).status_code, 400)
        quote = self.create().data
        self.assertEqual(self.client.patch(f"/api/quotes/{quote['id']}/", {"lines": [{"description": "Incomplete"}]}, format="json").status_code, 400)
        self.assertEqual(self.create(lines=[]).status_code, 400)
        self.assertEqual(self.create(expires_at="2000-01-01").status_code, 400)

    def test_foreign_customer_product_quote_and_company_payload_are_denied(self):
        self.assertEqual(self.create(customer_id=self.foreign_customer.pk).status_code, 404)
        product = Product.objects.create(company=self.other_company, reference="P1", name="Private")
        self.assertEqual(self.create(lines=[{**self.quote_input()["lines"][0], "product_id": product.pk}]).status_code, 404)
        created = self.create().data
        Quote.objects.filter(pk=created["id"]).update(company=self.other_company)
        self.assertEqual(self.client.get(f"/api/quotes/{created['id']}/").status_code, 404)
        self.assertEqual(self.action(created["id"], "accept").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/quotes/{created['id']}/", {"subject": "Hack"}, format="json").status_code, 404)
        self.assertEqual(self.client.get("/api/quotes/").data["results"], [])
        self.assertEqual(self.create(company_id=self.other_company.pk).status_code, 403)

    def test_authenticated_and_permission_denied(self):
        self.client.logout()
        self.assertEqual(self.client.get("/api/quotes/").status_code, 401)
        self.client.force_login(self.user)
        RolePermission.objects.filter(role=self.role, permission__code__startswith="quotes.").delete()
        self.assertEqual(self.client.get("/api/quotes/").status_code, 403)
        self.assertEqual(self.create().status_code, 403)

    def test_send_view_accept_workflow_and_repeated_operations(self):
        qid = self.create().data["id"]
        self.assertEqual(self.action(qid, "accept").status_code, 409)
        self.assertEqual(self.action(qid, "send").data["status"], "sent")
        count = QuoteActivity.objects.filter(quote_id=qid).count()
        self.assertEqual(self.action(qid, "send").status_code, 200)
        self.assertEqual(QuoteActivity.objects.filter(quote_id=qid).count(), count)
        self.assertEqual(self.action(qid, "viewed").data["status"], "viewed")
        self.assertEqual(self.action(qid, "accept").data["status"], "accepted")
        self.assertEqual(self.action(qid, "accept").status_code, 409)
        self.assertEqual(self.action(qid, "send").status_code, 409)
        self.assertEqual(self.client.patch(f"/api/quotes/{qid}/", {"subject": "Changed"}, format="json").status_code, 409)

    def test_reject_expire_and_date_rules(self):
        qid = self.create().data["id"]
        self.action(qid, "send")
        self.assertEqual(self.action(qid, "reject").data["status"], "rejected")
        self.assertEqual(self.action(qid, "accept").status_code, 409)
        qid = self.create().data["id"]
        self.assertEqual(self.action(qid, "expire").status_code, 409)
        Quote.objects.filter(pk=qid).update(issue_date=timezone.localdate() - timedelta(days=40), expires_at=timezone.localdate() - timedelta(days=1))
        self.assertEqual(self.action(qid, "send").status_code, 409)
        self.assertEqual(self.action(qid, "expire").data["status"], "expired")

    def test_duplicate_is_new_draft_with_distinct_lines_and_number(self):
        original = self.create().data
        self.action(original["id"], "send")
        copy = self.action(original["id"], "duplicate")
        self.assertEqual(copy.status_code, 201, copy.data)
        self.assertNotEqual(copy.data["reference"], original["reference"])
        self.assertNotEqual(copy.data["lines"][0]["id"], original["lines"][0]["id"])
        self.assertEqual(copy.data["status"], "draft")
        self.assertEqual(copy.data["total_amount"], original["total_amount"])

    def test_filter_and_pagination_keep_dto_contract(self):
        first = self.create().data
        self.create()
        self.action(first["id"], "send")
        page = self.client.get("/api/quotes/?page_size=1")
        self.assertEqual(page.data["count"], 2)
        self.assertEqual(len(page.data["results"]), 1)
        self.assertIn("current_salesperson", page.data)
        result = self.client.get(f"/api/quotes/?status=sent&customer={self.customer.pk}&search=Alpha")
        self.assertEqual([q["id"] for q in result.data["results"]], [first["id"]])

    def test_create_and_transition_failures_roll_back_all_rows_and_sequence(self):
        with patch("apps.sales.services.QuoteActivity.objects.create", side_effect=RuntimeError("failure")):
            with self.assertRaises(RuntimeError):
                self.create()
        self.assertEqual(Quote.objects.count(), 0)
        self.assertEqual(QuoteLine.objects.count(), 0)
        self.assertFalse(DocumentSequence.objects.filter(kind="quote").exists())
        qid = self.create().data["id"]
        with patch("apps.sales.services.QuoteActivity.objects.create", side_effect=RuntimeError("failure")):
            with self.assertRaises(RuntimeError):
                self.action(qid, "send")
        self.assertEqual(Quote.objects.get(pk=qid).status, "draft")
