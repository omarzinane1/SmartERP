from decimal import Decimal
from unittest.mock import patch
from django.db import IntegrityError, transaction
from django.test import TestCase
from apps.accounts.models import RolePermission
from apps.inventory.models import Product, StockLevel, StockMovement, StockTransfer, Warehouse, CompanyInventorySetting
from apps.inventory.valuation import get_company_stock_value, get_product_stock_value, get_warehouse_stock_value
from apps.inventory.stock import apply_receipt_stock
from apps.purchasing.models import GoodsReceipt
from common.exceptions import BusinessConflict
from .support import InventoryDataMixin


class StockTests(InventoryDataMixin, TestCase):
    def test_decimal_movements_weighted_average_issue_and_exact_residual(self):
        p = self.product()
        self.assertEqual(self.movement(p, unit_cost="100.000000").status_code, 201)
        self.assertEqual(self.movement(p, unit_cost="120.000000").status_code, 201)
        level = StockLevel.objects.get(product_id=p["id"])
        self.assertEqual((level.quantity_on_hand, level.total_value), (20, 2200))
        self.assertEqual(self.client.get(f"/api/products/{p['id']}/").data["averageCost"], 110)
        self.assertEqual(self.movement(p, "0.125", type="out").status_code, 201)
        level.refresh_from_db()
        self.assertEqual((level.quantity_on_hand, level.total_value), (Decimal("19.875"), Decimal("2186.25")))
        self.assertEqual(get_company_stock_value(company=self.company), level.total_value)
        self.assertEqual(get_product_stock_value(company=self.company, product=level.product), level.total_value)
        self.assertEqual(get_warehouse_stock_value(company=self.company, warehouse=self.warehouse), level.total_value)
        self.assertEqual(self.movement(p, "19.875", type="out").status_code, 201)
        level.refresh_from_db()
        self.assertEqual((level.quantity_on_hand, level.total_value), (0, 0))
        self.assertEqual(StockMovement.objects.count(), 4)

    def test_adjustment_return_negative_protection_and_idempotency(self):
        p = self.product()
        first = self.movement(p, "1.250", type="adjustment", adjustment_direction="increase", key="same-movement")
        self.assertEqual(first.status_code, 201, first.data)
        second = self.movement(p, "1.250", type="adjustment", adjustment_direction="increase", key="same-movement")
        self.assertEqual(first.data["id"], second.data["id"])
        self.assertEqual(self.movement(p, "2.000", type="out").status_code, 409)
        self.assertEqual(self.movement(p, "2.000", key="same-movement").status_code, 409)
        self.assertEqual(self.movement(p, ".250", type="adjustment", adjustment_direction="decrease").status_code, 201)
        self.assertEqual(self.movement(p, ".500", type="return").status_code, 201)
        self.assertEqual(StockLevel.objects.get(product_id=p["id"]).quantity_on_hand, Decimal("1.500"))
        self.assertEqual(StockMovement.objects.count(), 3)

    def test_foreign_product_warehouse_and_permissions(self):
        p = self.product()
        foreign = Product.objects.create(company=self.other_company, name="Foreign", reference="F")
        self.assertEqual(self.movement(p, warehouse_id=self.foreign_warehouse.pk).status_code, 404)
        self.assertEqual(self.movement(dict(id=foreign.pk)).status_code, 404)
        self.assertEqual(self.client.get("/api/inventory/summary/?company_id=999").data["value"], 0)
        self.user.is_superuser = True
        self.user.save()
        RolePermission.objects.filter(role=self.role, permission__code="inventory.movements.create").delete()
        self.assertEqual(self.movement(p).status_code, 403)
        self.assertFalse(StockMovement.objects.exists())

    def test_invalid_quantities_unknown_totals_and_rollback(self):
        p = self.product()
        for quantity in ("0", "-1", "0.0001", "NaN"):
            self.assertEqual(self.movement(p, quantity).status_code, 400)
        self.assertEqual(self.movement(p, total_value=999).status_code, 400)
        with patch("apps.inventory.stock.StockLevel.save", side_effect=RuntimeError("late failure")):
            with self.assertRaises(RuntimeError):
                self.movement(p)
        self.assertFalse(StockMovement.objects.exists())
        self.assertFalse(StockLevel.objects.exists())

    def test_low_stock_threshold_global_and_per_warehouse(self):
        p = self.product()
        self.movement(p, "6.000")
        self.assertEqual(self.client.get("/api/inventory/low-stock/").data["count"], 0)
        self.movement(p, "1.000", type="out")
        rows = self.client.get("/api/inventory/critical/").data["rows"]
        self.assertEqual((len(rows), rows[0]["available"], rows[0]["health"]), (1, 5, "low_stock"))
        self.movement(p, "1.000", type="out")
        self.assertEqual(self.client.get("/api/inventory/critical/").data["rows"][0]["available"], 4)
        Warehouse.objects.create(company=self.company, name="Empty", code="E")
        rows = self.client.get("/api/inventory/critical/").data["rows"]
        self.assertEqual(len(rows), 2)
        self.assertNotIn(self.foreign_warehouse.pk, [r["warehouseId"] for r in rows])

    def test_unsupported_valuation_blocks_without_writes(self):
        p = self.product()
        for method in ("fifo", "standard"):
            CompanyInventorySetting.objects.update_or_create(company=self.company, defaults=dict(valuation_method=method))
            self.assertEqual(self.movement(p).status_code, 409)
            self.assertEqual(self.client.get("/api/inventory/summary/").status_code, 409)
            self.assertEqual(self.client.get(f"/api/warehouses/{self.warehouse.pk}/valuation/").status_code, 409)
        self.assertFalse(StockMovement.objects.exists())

    def test_transfer_complete_only_preserves_value_and_prevents_double_completion(self):
        p = self.product()
        self.movement(p, "10.000", unit_cost="110")
        transfer = self.transfer(p, "3.250")
        for action in ("ready", "start"):
            self.assertEqual(self.post(f"/api/inventory/transfers/{transfer['id']}/{action}/").status_code, 200)
            self.assertEqual(StockLevel.objects.get(product_id=p["id"], warehouse=self.warehouse).quantity_on_hand, 10)
        self.assertEqual(self.post(f"/api/inventory/transfers/{transfer['id']}/complete/").status_code, 200)
        self.assertEqual(StockLevel.objects.get(product_id=p["id"], warehouse=self.warehouse).quantity_on_hand, Decimal("6.750"))
        self.assertEqual(StockLevel.objects.get(product_id=p["id"], warehouse_id=transfer["destinationId"]).quantity_on_hand, Decimal("3.250"))
        self.assertEqual(get_company_stock_value(company=self.company), 1100)
        self.assertEqual(StockMovement.objects.filter(transfer_line__transfer_id=transfer["id"]).count(), 2)
        self.assertEqual(self.post(f"/api/inventory/transfers/{transfer['id']}/complete/").status_code, 409)

    def test_transfer_validation_cancel_and_stock_rechecked(self):
        p = self.product()
        self.movement(p)
        transfer = self.transfer(p, "8.000")
        path = f"/api/inventory/transfers/{transfer['id']}/"
        self.assertEqual(self.client.patch(path, dict(destination_warehouse_id=self.warehouse.pk), format="json").status_code, 400)
        self.assertEqual(self.client.patch(path, dict(destination_warehouse_id=self.foreign_warehouse.pk), format="json").status_code, 404)
        self.assertEqual(self.client.patch(path, dict(status="completed"), format="json").status_code, 400)
        self.assertEqual(self.post(path+"ready/").status_code, 200)
        self.assertEqual(self.post(path+"start/").status_code, 200)
        self.movement(p, "5.000", type="out")
        self.assertEqual(self.post(path+"complete/").status_code, 409)
        self.assertEqual(self.post(path+"cancel/").status_code, 200)
        self.assertEqual(self.post(path+"complete/").status_code, 409)
        self.assertFalse(StockMovement.objects.filter(transfer_line__transfer_id=transfer["id"]).exists())

    def test_transfer_atomic_rollback_second_leg(self):
        p = self.product()
        self.movement(p)
        transfer = self.transfer(p)
        path = f"/api/inventory/transfers/{transfer['id']}/"
        self.post(path+"ready/")
        self.post(path+"start/")
        from apps.inventory.stock import _record_movement
        def writer(**kwargs):
            if kwargs["movement_type"] == "transfer_in":
                raise RuntimeError("destination failure")
            return _record_movement(**kwargs)
        with patch("apps.inventory.transfer_services._record_movement", side_effect=writer):
            with self.assertRaises(RuntimeError):
                self.post(path+"complete/")
        self.assertEqual(StockTransfer.objects.get(pk=transfer["id"]).status, "in_transit")
        self.assertEqual(StockLevel.objects.get(product_id=p["id"], warehouse=self.warehouse).quantity_on_hand, 10)
        self.assertEqual(StockMovement.objects.count(), 1)

    def test_database_negative_projection_constraint(self):
        p = self.product()
        with self.assertRaises(IntegrityError), transaction.atomic():
            StockLevel.objects.create(company=self.company, product_id=p["id"], warehouse=self.warehouse, quantity_on_hand=-1)

    def test_receipt_stock_flow_snapshot_and_duplicate_guard(self):
        p = self.product()
        order = self.purchase(confirmed=False)
        data = dict(lines=[dict(product_id=p["id"], product_name=p["name"], description="Snapshot", quantity="10.000", unit_price="120.00", discount_rate="10.00", tax_rate="20.00")])
        self.assertEqual(self.client.patch(f"/api/purchase-orders/{order['id']}/", data, format="json").status_code, 200)
        order = self.post(f"/api/purchase-orders/{order['id']}/confirm/").data
        self.client.patch(f"/api/products/{p['id']}/", dict(purchase_price="140.00"), format="json")
        first = self.receipt(order, "2.500", key="receipt-stock-once")
        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(self.receipt(order, "2.500", key="receipt-stock-once").status_code, 200)
        level = StockLevel.objects.get(product_id=p["id"])
        self.assertEqual((level.quantity_on_hand, level.total_value), (Decimal("2.500"), Decimal("270.000000")))
        receipt = GoodsReceipt.objects.get(order_id=order["id"])
        self.assertIsNotNone(receipt.stock_applied_at)
        with self.assertRaises(BusinessConflict):
            apply_receipt_stock(company=self.company, membership=self.membership, receipt=receipt)
        self.assertEqual(StockMovement.objects.count(), 1)

    def test_stock_read_endpoints_filters_and_history(self):
        p = self.product()
        movement = self.movement(p).data
        for path in ("/api/inventory/summary/", "/api/inventory/health/", "/api/inventory/recent-movements/", f"/api/inventory/movements/{movement['id']}/", f"/api/products/{p['id']}/metrics/", f"/api/products/{p['id']}/history/", f"/api/warehouses/{self.warehouse.pk}/inventory/", f"/api/warehouses/{self.warehouse.pk}/movements/", f"/api/warehouses/{self.warehouse.pk}/valuation/"):
            result = self.client.get(path)
            self.assertEqual(result.status_code, 200, (path, result.data))
        result = self.client.get(f"/api/inventory/movements/?product={p['id']}&warehouse={self.warehouse.pk}&type=in&search=MOV")
        self.assertEqual(result.data["count"], 1)
        self.assertEqual(self.client.get("/api/inventory/movements/?type=out").data["count"], 0)
