from django.utils import timezone
from apps.accounts.models import Permission, RolePermission
from apps.purchasing.tests.support import PurchasingDataMixin


class InventoryDataMixin(PurchasingDataMixin):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        for code in ("supplier_invoices.view", "supplier_invoices.create", "supplier_invoices.edit", "products.view", "products.create", "products.edit", "products.export",
            "warehouses.view", "warehouses.create", "inventory.view", "inventory.analytics.view", "analytics.view", "inventory.movements.view", "inventory.movements.create",
            "inventory.transfers.view", "inventory.transfers.create", "inventory.transfers.approve", "expenses.view", "expenses.create", "expenses.approve", "expenses.export"):
            RolePermission.objects.get_or_create(role=cls.role, permission=Permission.objects.get(code=code))

    def product_input(self, supplier=None, **changes):
        supplier = supplier or self.supplier()
        return dict(name="Produit fractionnaire", sku="SKU-1", type="product", category="Fournitures", unit="unit", supplier_id=supplier["id"],
            purchase_price="100.00", selling_price="140.00", barcode="", minimum_stock="5.000", maximum_stock="100.000", description="Article", **changes)

    def product(self, **changes):
        values = self.product_input()
        values.update(changes)
        result = self.post("/api/products/", values)
        self.assertEqual(result.status_code, 201, result.data)
        return result.data

    def movement(self, product, quantity="10.000", **changes):
        data = dict(product_id=product["id"], warehouse_id=self.warehouse.pk, quantity=quantity, type="in", date=timezone.localdate().isoformat(), source_reference="", note="")
        key = changes.pop("key", None)
        data.update(changes)
        return self.post("/api/inventory/movements/", data, key=key)

    def transfer(self, product, quantity="3.000", destination=None):
        if destination is None:
            from apps.inventory.models import Warehouse
            destination = Warehouse.objects.create(company=self.company, code="SECOND", name="Second dépôt")
        result = self.post("/api/inventory/transfers/", dict(source_warehouse_id=self.warehouse.pk, destination_warehouse_id=destination.pk,
            date=timezone.localdate().isoformat(), reference_external="", notes="", lines=[dict(product_id=product["id"], quantity=quantity)]))
        self.assertEqual(result.status_code, 201, result.data)
        return result.data
