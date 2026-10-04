from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from django.test import TestCase
from django.utils import timezone
from apps.accounts.models import RolePermission
from apps.finance.models import ExpenseCategory, Expense, Payment
from apps.purchasing.models import SupplierInvoice
from apps.approvals.models import ApprovalRequest
from common.tests.finance_documents_support import FinanceDocumentsMixin


class FinanceSummaryTests(FinanceDocumentsMixin, TestCase):
    def test_category_unique_scoped_and_inactive(self):
        data = dict(name="Services externes", code="EXT", description="Prestations")
        response = self.post("/api/expense-categories/", data)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(self.post("/api/expense-categories/", data).status_code, 409)
        ExpenseCategory.objects.create(company=self.other_company, **data)
        result = self.expense(category=data["name"])
        self.assertEqual(Expense.objects.get(pk=result["id"]).category_record_id, response.data["id"])
        self.client.patch(f"/api/expense-categories/{response.data['id']}/", dict(is_active=False), format="json")
        payload = dict(date=timezone.localdate().isoformat(), description="Facture service", category=data["name"], supplier_id=None, employee="Employé", amount_ht="1", tax_rate="0", note="")
        self.assertEqual(self.post("/api/expenses/", payload).status_code, 400)
        self.assertEqual(self.client.get("/api/expense-categories/").data["count"], 1)

    def test_category_permissions_foreign_and_rollback(self):
        foreign = ExpenseCategory.objects.create(company=self.other_company, name="Étranger", code="X")
        self.assertEqual(self.client.patch(f"/api/expense-categories/{foreign.pk}/", dict(name="Volé"), format="json").status_code, 404)
        with patch("apps.finance.expense_services.Expense.save", side_effect=RuntimeError("rollback")):
            with self.assertRaises(RuntimeError):
                self.expense(category="Annulation transaction")
        self.assertFalse(ExpenseCategory.objects.filter(company=self.company).exists())
        RolePermission.objects.filter(role=self.role, permission__code="expenses.create").delete()
        self.assertEqual(self.post("/api/expense-categories/", dict(name="Interdit")).status_code, 403)

    def test_cash_payment_source_no_approved_expense_double_count(self):
        self.assertEqual(self.payment(amount="100.01").status_code, 201)
        supplier = self.supplier()
        outgoing = self.post("/api/payments/", dict(direction="outgoing", partner_id=supplier["id"], amount="30.02", date=timezone.localdate().isoformat(), method="cash"))
        self.assertEqual(outgoing.status_code, 201, outgoing.data)
        expense = self.expense(submitted=True)
        self.assertEqual(self.post(f"/api/expenses/{expense['id']}/approve/").status_code, 200)
        result = self.client.get("/api/finance/cash-flow/")
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual((result.data["incoming"], result.data["outgoing"], result.data["netCashFlow"]), (Decimal("100.01"), Decimal("30.02"), Decimal("69.99")))
        self.assertEqual(result.data["history"][-1]["actual"], Decimal("69.99"))
        self.assertIsNone(result.data["opening"])
        self.assertIsNone(result.data["cash"])
        self.post(f"/api/payments/{outgoing.data['id']}/cancel/")
        self.assertEqual(self.client.get("/api/finance/cash-flow/").data["netCashFlow"], Decimal("100.01"))

    def test_period_empty_validation_isolation_and_permission(self):
        payment = self.payment().data
        today = timezone.localdate()
        prior = today-timedelta(days=1)
        result = self.client.get("/api/finance/cash-flow/", dict(from_date=prior, to_date=prior))
        self.assertEqual(result.data["incoming"], 0)
        self.assertEqual(len(result.data["history"]), 1)
        self.assertEqual(self.client.get("/api/finance/cash-flow/", dict(from_date=today, to_date=prior)).status_code, 400)
        self.assertEqual(self.client.get("/api/finance/kpis/", dict(from_date="wrong")).status_code, 400)
        Payment.objects.filter(pk=payment["id"]).update(company=self.other_company)
        self.assertEqual(self.client.get("/api/finance/cash-flow/").data["incoming"], 0)
        RolePermission.objects.filter(role=self.role, permission__code="cashflow.view").delete()
        self.assertEqual(self.client.get("/api/finance/cash-flow/").status_code, 403)

    def test_finance_kpis_match_business_balances_and_sql_query_bound(self):
        invoice = self.invoice(overdue=True)
        self.payment(invoice, amount="400.00")
        expense = self.expense(submitted=True)
        self.post(f"/api/expenses/{expense['id']}/approve/")
        supplier = self.supplier()
        SupplierInvoice.objects.create(company=self.company, supplier_id=supplier["id"], number="SI1", supplier_reference="SI-REF", issue_date=timezone.localdate()-timedelta(days=4),
            due_date=timezone.localdate()-timedelta(days=1), currency="MAD", status="posted", gross_total=200, subtotal=200, total=200, balance_due=200,
            created_by=self.user, operation_key="supplier-test", request_fingerprint="x")
        result = self.client.get("/api/finance/kpis/")
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data["receivables"]["total"], 600)
        self.assertEqual(result.data["receivables"]["overdue"], 600)
        self.assertEqual(result.data["payables"]["overdue"], 200)
        self.assertEqual(result.data["expenses"]["total"], Decimal("23.99"))
        self.assertEqual(result.data["cashFlow"]["incoming"], 400)
        self.assertIsNone(result.data["grossMargin"])
        self.assertEqual(sum(bucket["amount"] for bucket in self.client.get("/api/finance/cash-flow/").data["receivableAging"]), 600)
        self.assertEqual(len(self.client.get("/api/finance/upcoming-payments/").data["suppliers"]), 1)

    def test_submit_rollback_and_withdrawal_are_synchronized(self):
        expense = self.expense()
        with patch("apps.approvals.services._new_request", side_effect=RuntimeError("failure")):
            with self.assertRaises(RuntimeError):
                self.post(f"/api/expenses/{expense['id']}/submit/")
        self.assertEqual(Expense.objects.get(pk=expense["id"]).status, "draft")
        self.assertFalse(ApprovalRequest.objects.exists())
        self.post(f"/api/expenses/{expense['id']}/submit/")
        self.assertEqual(self.post(f"/api/expenses/{expense['id']}/cancel/").status_code, 200)
        self.assertEqual(Expense.objects.get(pk=expense["id"]).status, "draft")
        self.assertEqual(ApprovalRequest.objects.get().status, "cancelled")
        self.assertEqual(self.post(f"/api/expenses/{expense['id']}/submit/").status_code, 200)
