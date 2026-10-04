from unittest.mock import patch
from django.test import TestCase
from apps.accounts.models import RolePermission
from apps.finance.models import Expense
from apps.purchasing.models import PurchaseOrder
from common.tests.finance_documents_support import FinanceDocumentsMixin
from apps.approvals.models import ApprovalRequest


class ApprovalAPITests(FinanceDocumentsMixin, TestCase):
    def decision(self, request, action="approve", **data):
        return self.post(f"/api/approvals/{request.pk}/{action}/", dict(version=request.version, comment="Décision motivée", **data))

    def test_expense_submit_center_approve_and_double_decision(self):
        expense = self.expense(submitted=True)
        request = ApprovalRequest.objects.get(expense_id=expense["id"])
        rows = self.client.get("/api/approvals/?status=pending&type=expense").data
        self.assertEqual(rows["count"], 1)
        self.assertEqual(self.client.get(f"/api/approvals/{request.pk}/").status_code, 200)
        self.assertEqual(self.decision(request).status_code, 200)
        expense = Expense.objects.get(pk=expense["id"])
        request.refresh_from_db()
        self.assertEqual((expense.status, request.status), ("approved", "approved"))
        self.assertEqual(expense.approved_by_id, self.user.pk)
        self.assertEqual(request.decided_by_id, self.user.pk)
        self.assertEqual(self.decision(request, "reject").status_code, 409)

    def test_reject_comment_and_direct_expense_uses_same_request(self):
        expense = self.expense(submitted=True)
        request = ApprovalRequest.objects.get()
        path = f"/api/approvals/{request.pk}/reject/"
        self.assertEqual(self.post(path, dict(version=1, comment="")).status_code, 400)
        long_comment = "Justificatif absent " * 80
        result = self.post(path, dict(version=1, comment=long_comment))
        self.assertEqual(result.status_code, 200, result.data)
        obj = Expense.objects.get(pk=expense["id"])
        self.assertEqual((obj.status, obj.rejection_reason), ("rejected", long_comment.strip()))
        next_expense = self.expense(submitted=True)
        self.post(f"/api/expenses/{next_expense['id']}/approve/")
        self.assertEqual(ApprovalRequest.objects.get(expense_id=next_expense["id"]).status, "approved")

    def test_foreign_request_entity_permission_and_no_superuser_bypass(self):
        expense = self.expense(submitted=True)
        request = ApprovalRequest.objects.get()
        ApprovalRequest.objects.filter(pk=request.pk).update(company=self.other_company)
        self.assertEqual(self.decision(request).status_code, 404)
        self.assertEqual(self.client.get(f"/api/approvals/{request.pk}/").status_code, 404)
        self.assertEqual(self.client.get("/api/approvals/").data["count"], 0)
        ApprovalRequest.objects.filter(pk=request.pk).update(company=self.company)
        Expense.objects.filter(pk=expense["id"]).update(company=self.other_company)
        self.assertEqual(self.decision(request).status_code, 404)
        self.user.is_superuser = True
        self.user.save()
        RolePermission.objects.filter(role=self.role, permission__code="approvals.approve").delete()
        self.assertEqual(self.decision(request).status_code, 403)

    def test_purchase_review_is_independent_and_stale_version_refused(self):
        order = self.purchase(confirmed=False)
        response = self.post("/api/approvals/", dict(type="purchase", record_id=order["id"]))
        self.assertEqual(response.status_code, 201, response.data)
        request = ApprovalRequest.objects.get()
        self.assertEqual(self.post("/api/approvals/", dict(type="purchase", record_id=order["id"])).status_code, 409)
        self.assertEqual(self.post(f"/api/approvals/{request.pk}/approve/", dict(version=99, comment="")).status_code, 409)
        self.assertEqual(self.decision(request).status_code, 200)
        self.assertEqual(PurchaseOrder.objects.get(pk=order["id"]).status, "draft")
        self.assertEqual(self.post("/api/approvals/", dict(type="purchase", record_id=999999)).status_code, 404)

    def test_cancellation_and_decision_rollback(self):
        self.expense(submitted=True)
        request = ApprovalRequest.objects.get()
        with patch("apps.approvals.services.ApprovalRequest.save", side_effect=RuntimeError("late failure")):
            with self.assertRaises(RuntimeError):
                self.decision(request)
        request.refresh_from_db()
        self.assertEqual((request.status, request.expense.status), ("pending", "submitted"))
        self.assertEqual(self.decision(request, "cancel").status_code, 200)
        request.refresh_from_db()
        self.assertEqual((request.status, request.expense.status), ("cancelled", "draft"))
        self.assertEqual(self.decision(request).status_code, 409)
