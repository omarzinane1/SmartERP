from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.db import connection
from django.test.utils import CaptureQueriesContext
from apps.accounts.models import RolePermission
from common.tests.finance_documents_support import FinanceDocumentsMixin


class AnalyticsTests(FinanceDocumentsMixin, TestCase):
    def test_all_datasets_empty_or_initial_and_validation(self):
        from apps.reporting.analytics import SPECS
        for kind in SPECS:
            with self.subTest(kind=kind):
                response = self.client.get(f"/api/reports/{kind}/")
                self.assertEqual(response.status_code, 200, response.data)
                self.assertIn("summary", response.data)
                self.assertLessEqual(len(response.data["rows"]), 50)
        for query in ["group_by=year", "ordering=password", "date_from=2026-02-02&date_to=2026-01-01", "page_size=1000"]:
            self.assertEqual(self.client.get(f"/api/reports/payments/?{query}").status_code, 400)

    def test_exact_aggregates_granularity_filters_pagination_and_exports(self):
        self.payment(amount="19.99")
        self.payment(amount="10.02")
        day = timezone.localdate().isoformat()
        for grain in ["day", "week", "month"]:
            response = self.client.get(f"/api/reports/payments/?date_from={day}&date_to={day}&group_by={grain}&page_size=1")
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data["summary"]["amount"], Decimal("30.01"))
            self.assertEqual(response.data["series"][0]["value"], Decimal("30.01"))
            self.assertEqual(response.data["count"], 2)
            self.assertEqual(len(response.data["rows"]), 1)
        filtered = self.client.get("/api/reports/payments/?partner=absent")
        self.assertEqual(filtered.data["summary"]["count"], 0)
        response = self.client.get("/api/reports/payments/export/?format=csv")
        self.assertEqual(response.status_code, 200)
        self.assertIn("19.99", b"".join(response.streaming_content).decode("utf-8-sig"))

    def test_tenant_permissions_and_no_superuser_bypass(self):
        from apps.finance.models import Payment
        self.payment()
        Payment.objects.all().update(company=self.other_company)
        self.assertEqual(self.client.get("/api/reports/payments/").data["summary"]["count"], 0)
        self.user.is_superuser = True
        self.user.save()
        RolePermission.objects.filter(role=self.role, permission__code="payments.view").delete()
        self.assertEqual(self.client.get("/api/reports/payments/").status_code, 403)
        self.assertEqual(self.client.get("/api/reports/payments/export/").status_code, 403)

    def test_dashboard_known_ledger_and_unknown_values(self):
        self.invoice(overdue=True, price="100.00", quantity="2.000")
        self.payment(amount="19.99")
        exp = self.expense(submitted=True)
        self.assertEqual(self.post(f"/api/expenses/{exp['id']}/approve/").status_code, 200)
        product = self.product()
        self.assertEqual(self.movement(product, quantity="2.000").status_code, 201)
        with CaptureQueriesContext(connection) as captured:
            response = self.client.get("/api/dashboard/summary/")
        self.assertEqual(response.status_code, 200, response.data)
        d = response.data
        self.assertEqual(d["revenueBreakdown"]["revenue"], Decimal("200.00"))
        self.assertEqual(d["metrics"]["receivables"]["total"], Decimal("200.00"))
        self.assertEqual(d["metrics"]["receivables"]["overdueCount"], 1)
        self.assertEqual(d["metrics"]["payables"]["total"], 0)
        self.assertEqual(d["metrics"]["expenses"]["total"], Decimal("23.99"))
        self.assertEqual(d["inventory"]["value"], Decimal("200.000000"))
        self.assertIsNone(d["revenueBreakdown"]["grossProfit"])
        self.assertIsNone(d["cashFlow"]["current"])
        self.assertLessEqual(len(captured), 60)

    def test_dashboard_permissions_and_empty(self):
        response = self.client.get("/api/dashboard/executive/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["metrics"]["receivables"]["total"], 0)
        RolePermission.objects.filter(role=self.role, permission__code="invoices.view").delete()
        data = self.client.get("/api/dashboard/summary/").data
        self.assertIsNone(data["revenueBreakdown"]["revenue"])
        self.assertEqual(data["recentInvoices"], [])
        RolePermission.objects.filter(role=self.role, permission__code="analytics.view").delete()
        self.assertEqual(self.client.get("/api/dashboard/summary/").status_code, 403)
