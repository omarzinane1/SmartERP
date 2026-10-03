from decimal import Decimal
from django.test import TestCase
from apps.accounts.models import RolePermission
from apps.inventory.models import Product, ProductCategory, UnitOfMeasure, Warehouse, ProductPriceRecord
from .support import InventoryDataMixin


class CatalogTests(InventoryDataMixin, TestCase):
    def test_categories_units_create_and_duplicate_tenant_scoping(self):
        for path, model in [("product-categories", ProductCategory), ("units", UnitOfMeasure)]:
            result = self.post(f"/api/{path}/", dict(name="kg", code="KILO"))
            self.assertEqual(result.status_code, 201, result.data)
            self.assertEqual(self.post(f"/api/{path}/", dict(name="kg", code="KILO")).status_code, 409)
            model.objects.create(company=self.other_company, name="kg", code="KILO")
            self.assertEqual(self.client.get(f"/api/{path}/").data["count"], 1)

    def test_product_create_update_unique_per_company_search_price_history(self):
        product = self.product()
        self.assertEqual(product["available"], 0)
        self.assertEqual(self.post("/api/products/", self.product_input()).status_code, 409)
        Product.objects.create(company=self.other_company, reference=product["sku"], name="Foreign")
        result = self.client.patch(f"/api/products/{product['id']}/", dict(purchase_price="120.15", category="Nouveau"), format="json")
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data["purchasePrice"], Decimal("120.15"))
        self.assertEqual(result.data["category"], "Nouveau")
        self.assertEqual(self.client.get("/api/products/?search=fraction&category=Nouveau&status=active").data["count"], 1)
        self.assertEqual(self.client.get("/api/products/?search=Foreign").data["count"], 0)
        self.assertEqual(ProductPriceRecord.objects.filter(product_id=product["id"]).count(), 2)
        self.assertEqual(len(self.client.get(f"/api/products/{product['id']}/history/").data["prices"]), 2)

    def test_product_foreign_relations_and_unknown_fields(self):
        product = self.product()
        foreign = Product.objects.create(company=self.other_company, reference="F", name="Foreign")
        self.assertEqual(self.client.get(f"/api/products/{foreign.pk}/").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/products/{foreign.pk}/", {"name": "Changed"}, format="json").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/products/{product['id']}/", {"stock": 100, "company_id": self.other_company.pk}, format="json").status_code, 403)
        self.assertEqual(self.client.patch(f"/api/products/{product['id']}/", {"supplier_id": 999999}, format="json").status_code, 404)

    def test_product_service_and_archive_rules_unit_immutable_after_stock(self):
        service = self.product(type="service")
        self.assertIsNone(service["onHand"])
        self.assertEqual(self.movement(service).status_code, 409)
        product = self.product(sku="STOCK")
        self.assertEqual(self.movement(product).status_code, 201)
        for data in ({"status": "archived"}, {"unit": "kg"}, {"type": "service"}):
            self.assertEqual(self.client.patch(f"/api/products/{product['id']}/", data, format="json").status_code, 409)
        self.assertEqual(self.movement(product, type="out").status_code, 201)
        self.assertEqual(self.client.patch(f"/api/products/{product['id']}/", {"status": "archived"}, format="json").status_code, 200)

    def test_product_threshold_price_validation_and_permissions(self):
        product = self.product()
        for data in ({"purchase_price": "-1"}, {"selling_price": "1.234"}, {"minimum_stock": 20, "maximum_stock": 10}):
            self.assertEqual(self.client.patch(f"/api/products/{product['id']}/", data, format="json").status_code, 400)
        self.user.is_superuser = True
        self.user.save()
        RolePermission.objects.filter(role=self.role, permission__code__startswith="products.").delete()
        self.assertEqual(self.client.get("/api/products/").status_code, 403)
        self.assertEqual(self.client.patch(f"/api/products/{product['id']}/", {"name": "Blocked"}, format="json").status_code, 403)
        self.assertEqual(self.post("/api/units/", {"name": "box"}).status_code, 403)

    def test_warehouse_reuses_existing_initial_row_and_uniqueness(self):
        result = self.client.get("/api/warehouses/")
        self.assertEqual(result.data["count"], 1)
        self.assertEqual(result.data["warehouses"][0]["id"], self.warehouse.pk)
        data = dict(name="Dépôt B", city="Fès", country="Maroc", manager="Responsable", capacity=100, code="SECOND")
        created = self.post("/api/warehouses/", data)
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(self.post("/api/warehouses/", data).status_code, 409)
        Warehouse.objects.create(company=self.other_company, name="Other", code="SECOND")
        self.assertEqual(self.client.get(f"/api/warehouses/{self.foreign_warehouse.pk}/").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/warehouses/{created.data['id']}/", {"city": "Rabat"}, format="json").status_code, 200)
        RolePermission.objects.filter(role=self.role, permission__code="warehouses.create").delete()
        self.assertEqual(self.post("/api/warehouses/", data).status_code, 403)

    def test_product_and_warehouse_pagination(self):
        Product.objects.bulk_create([Product(company=self.company, name=f"Product {n}", reference=f"P{n}") for n in range(105)])
        result = self.client.get("/api/products/?page_size=1000")
        self.assertEqual(result.data["count"], 105)
        self.assertEqual(len(result.data["products"]), 100)
        self.assertIsNotNone(result.data["next"])
        self.assertEqual(len(self.client.get("/api/products/?page=2&page_size=100").data["products"]), 5)
