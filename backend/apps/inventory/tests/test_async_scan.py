from django.test import TestCase
from apps.accounts.models import Permission, RolePermission
from apps.inventory.models import Product, Warehouse, StockLevel, StockMovement, CompanyInventorySetting
from apps.inventory.selectors import low_stock_queryset, get_low_stock_products
from apps.inventory.tasks import scan_low_stock
from apps.notifications.models import Notification
from common.tests.async_support import AsyncDataMixin


class LowStockScanTests(AsyncDataMixin, TestCase):
    def test_threshold_missing_level_and_no_stock_mutation(self):
        products = []
        for index, amount in enumerate([6, 5, 4, None]):
            product = Product.objects.create(company=self.company, reference=f"P{index}", name=f"Product{index}", minimum_stock=5)
            products.append(product)
            if amount is not None:
                StockLevel.objects.create(company=self.company, warehouse=self.warehouse, product=product, quantity_on_hand=amount)
        before = list(StockLevel.objects.order_by("pk").values())
        self.assertEqual(scan_low_stock.run()["created"], 3)
        self.assertEqual(set(Notification.objects.values_list("entity_id", flat=True)), {p.pk for p in products[1:]})
        self.assertEqual(scan_low_stock.run()["created"], 0)
        self.assertEqual(list(StockLevel.objects.order_by("pk").values()), before)
        self.assertFalse(StockMovement.objects.exists())
        self.assertEqual(set(low_stock_queryset(self.company, self.warehouse).values_list("pk", flat=True)), {r["productId"] for r in get_low_stock_products(company=self.company) if r["warehouseId"] == self.warehouse.pk})

    def test_company_warehouse_and_recipient_isolation(self):
        for code in ["inventory.view", "products.view"]:
            RolePermission.objects.get_or_create(role=self.other_role, permission=Permission.objects.get(code=code))
        warehouse = self.foreign_warehouse
        product = Product.objects.create(company=self.other_company, reference="OTHER", name="Other")
        Product.objects.create(company=self.company, reference="INACTIVE", name="Inactive", is_active=False)
        Product.objects.create(company=self.company, reference="SERVICE", name="Service", kind="service")
        self.assertEqual(scan_low_stock.run()["created"], 1)
        notice = Notification.objects.get()
        self.assertEqual((notice.company_id, notice.entity_id, notice.warehouse_id), (self.other_company.pk, product.pk, warehouse.pk))
        self.assertFalse(low_stock_queryset(self.company, warehouse).exists())
        CompanyInventorySetting.objects.update_or_create(company=self.other_company, defaults=dict(low_stock_alerts=False))
        Product.objects.create(company=self.other_company, reference="SECOND", name="Second")
        self.assertEqual(scan_low_stock.run()["created"], 0)
