from django.utils import timezone
from apps.accounts.models import Permission, RolePermission
from apps.inventory.tests.support import InventoryDataMixin


class FinanceDocumentsMixin(InventoryDataMixin):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        for code in ("finance.view", "cashflow.view", "approvals.view", "approvals.approve", "documents.view", "documents.upload", "documents.delete",
            "reports.view", "reports.generate", "reports.export", "customers.view", "customers.export", "suppliers.export", "quotes.export", "payments.export", "inventory.export"):
            RolePermission.objects.get_or_create(role=cls.role, permission=Permission.objects.get(code=code))

    def expense(self, submitted=False, **changes):
        data = dict(date=timezone.localdate().isoformat(), description="Dépense vérifiée", category="Fournitures", supplier_id=None,
            employee="Employé déclaré", amount_ht="19.99", tax_rate="20.00", note="")
        data.update(changes)
        response = self.post("/api/expenses/", data)
        self.assertEqual(response.status_code, 201, response.data)
        if submitted:
            response = self.post(f"/api/expenses/{response.data['id']}/submit/")
            self.assertEqual(response.status_code, 200, response.data)
        return response.data
