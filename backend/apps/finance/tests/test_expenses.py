from decimal import Decimal
from unittest.mock import patch
from django.test import TestCase
from django.utils import timezone
from apps.accounts.models import RolePermission
from apps.inventory.tests.support import InventoryDataMixin
from apps.finance.models import Expense


class ExpenseTests(InventoryDataMixin, TestCase):
    def data(self):
        return dict(date=timezone.localdate().isoformat(), description="Fournitures bureau", category="Fournitures", supplier_id=None,
            employee="Employé déclaré", amount_ht="19.99", tax_rate="20.00", note="")

    def test_create_decimal_list_detail_draft_update(self):
        result = self.post("/api/expenses/", self.data(), key="expense-create-once")
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual((result.data["taxAmount"], result.data["total"]), (Decimal("4.00"), Decimal("23.99")))
        self.assertEqual(self.post("/api/expenses/", self.data(), key="expense-create-once").data["id"], result.data["id"])
        path = f"/api/expenses/{result.data['id']}/"
        self.assertEqual(self.client.get(path).status_code, 200)
        self.assertEqual(self.client.get("/api/expenses/?search=bureau&category=Fournitures&status=draft").data["count"], 1)
        changed = self.client.patch(path, dict(amount_ht="0.05", tax_rate="10.00"), format="json")
        self.assertEqual(changed.status_code, 200, changed.data)
        self.assertEqual(changed.data["taxAmount"], Decimal("0.01"))

    def test_submit_approve_lock_and_no_payment(self):
        result = self.post("/api/expenses/", self.data())
        path = f"/api/expenses/{result.data['id']}/"
        self.assertEqual(self.post(path+"approve/").status_code, 409)
        self.assertEqual(self.post(path+"submit/").status_code, 200)
        self.assertEqual(self.client.patch(path, dict(amount_ht="3.00"), format="json").status_code, 409)
        self.assertEqual(self.post(path+"approve/").status_code, 200)
        self.assertEqual(self.post(path+"approve/").status_code, 409)
        obj = Expense.objects.get(pk=result.data["id"])
        self.assertEqual(obj.approved_by_id, self.user.pk)
        self.assertIsNotNone(obj.approved_at)
        self.assertIsNone(obj.paid_date)
        self.assertEqual(obj.status, "approved")

    def test_reject_requires_reason_and_locks(self):
        result = self.post("/api/expenses/", self.data())
        path = f"/api/expenses/{result.data['id']}/"
        self.post(path+"submit/")
        self.assertEqual(self.post(path+"reject/").status_code, 400)
        self.assertEqual(self.post(path+"reject/", dict(reason="Justificatif absent")).status_code, 200)
        self.assertEqual(self.post(path+"approve/").status_code, 409)
        obj = Expense.objects.get(pk=result.data["id"])
        self.assertEqual(obj.rejection_reason, "Justificatif absent")
        self.assertEqual(obj.rejected_by_id, self.user.pk)

    def test_foreign_supplier_expense_permissions_and_injected_status(self):
        self.assertEqual(self.post("/api/expenses/", {**self.data(), "supplier_id": 999999}).status_code, 404)
        self.assertEqual(self.post("/api/expenses/", {**self.data(), "status": "paid"}).status_code, 400)
        result = self.post("/api/expenses/", self.data())
        path = f"/api/expenses/{result.data['id']}/"
        self.post(path+"submit/")
        RolePermission.objects.filter(role=self.role, permission__code="expenses.approve").delete()
        self.user.is_superuser = True
        self.user.save()
        self.assertEqual(self.post(path+"approve/").status_code, 403)
        Expense.objects.filter(pk=result.data["id"]).update(company=self.other_company)
        self.assertEqual(self.client.get(path).status_code, 404)
        self.assertEqual(self.client.patch(path, {"note": "x"}, format="json").status_code, 404)
        self.assertEqual(self.client.get("/api/expenses/").data["count"], 0)

    def test_invalid_amount_and_creation_rollback(self):
        for changes in ({"amount_ht": "0"}, {"amount_ht": "-1"}, {"amount_ht": "1.001"}, {"tax_rate": 101}, {"total": 1}):
            self.assertEqual(self.post("/api/expenses/", {**self.data(), **changes}).status_code, 400)
        with patch("apps.finance.expense_services.Expense.save", side_effect=RuntimeError("failure")):
            with self.assertRaises(RuntimeError):
                self.post("/api/expenses/", self.data())
        self.assertFalse(Expense.objects.exists())
