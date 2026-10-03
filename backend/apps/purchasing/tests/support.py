from django.utils import timezone
from apps.finance.tests.support import LedgerDataMixin
from apps.inventory.models import Warehouse


class PurchasingDataMixin(LedgerDataMixin):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.warehouse = Warehouse.objects.create(company=cls.company, code="MAIN", name="Dépôt principal")
        cls.foreign_warehouse = Warehouse.objects.create(company=cls.other_company, code="MAIN", name="Dépôt étranger")

    def supplier_input(self):
        return dict(name="Fournisseur Alpha", contact="Contact", email="supplier@example.test", phone="", category="Services", country="Maroc", city="Rabat", buyer="RBAC Tester")

    def supplier(self):
        result = self.post("/api/suppliers/", self.supplier_input())
        self.assertEqual(result.status_code, 201, result.data)
        return result.data

    def purchase(self, supplier=None, confirmed=True):
        supplier = supplier or self.supplier()
        result = self.post("/api/purchase-orders/", dict(supplier_id=supplier["id"], date=timezone.localdate().isoformat(),
            expected_date=timezone.localdate().isoformat(), buyer="RBAC Tester", warehouse=self.warehouse.name, notes="",
            lines=[dict(product_name="Fourniture", description="", quantity="10.000", unit_price="19.99", discount_rate="10.00", tax_rate="20.00")]))
        self.assertEqual(result.status_code, 201, result.data)
        if confirmed:
            result = self.post(f"/api/purchase-orders/{result.data['id']}/confirm/")
            self.assertEqual(result.status_code, 200, result.data)
        return result.data

    def receipt(self, order, quantity="4.000", key=None, **changes):
        return self.post(f"/api/purchase-orders/{order['id']}/receive/", {"date": timezone.localdate().isoformat(),
            "warehouse": self.warehouse.name, "lines": [dict(line_id=order["lines"][0]["id"], quantity=quantity)], **changes}, key=key)
