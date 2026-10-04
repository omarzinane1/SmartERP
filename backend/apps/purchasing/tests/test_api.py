from decimal import Decimal
from unittest.mock import patch
from django.test import TestCase
from django.utils import timezone
from apps.accounts.models import RolePermission
from apps.finance.models import Payment
from apps.purchasing.models import Supplier, PurchaseOrder, GoodsReceipt, GoodsReceiptLine, PurchaseOrderLine
from .support import PurchasingDataMixin


class SupplierTests(PurchasingDataMixin, TestCase):
    def test_crud_search_validation_archive_and_empty_360(self):
        supplier = self.supplier()
        sid = supplier["id"]
        self.assertEqual(supplier["orders"], [])
        self.assertIsNone(supplier["risk"])
        self.assertIsNone(supplier["outstandingBalance"])
        self.assertIsNone(supplier["score"])
        self.assertEqual(self.client.get("/api/suppliers/?search=Alpha&page_size=1").data["count"], 1)
        self.assertEqual(self.client.get("/api/suppliers/?search=Unknown").data["count"], 0)
        result = self.client.patch(f"/api/suppliers/{sid}/", {"name": "Nouveau nom"}, format="json")
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data["name"], "Nouveau nom")
        self.assertEqual(self.client.patch(f"/api/suppliers/{sid}/", {"email": "bad"}, format="json").status_code, 400)
        self.assertEqual(self.post("/api/suppliers/", {**self.supplier_input(), "company_id": self.other_company.pk}).status_code, 403)
        self.assertEqual(self.post("/api/suppliers/", {**self.supplier_input(), "score": 100}).status_code, 400)
        self.assertEqual(self.client.get(f"/api/suppliers/{sid}/price-history/").data["points"], [])
        metrics = self.client.get(f"/api/suppliers/{sid}/metrics/").data
        self.assertEqual(metrics["purchaseVolume"], 0)
        self.assertIsNone(metrics["averageLeadTimeDays"])
        self.assertEqual(self.client.patch(f"/api/suppliers/{sid}/", {"status": "archived"}, format="json").status_code, 200)
        self.assertTrue(Supplier.objects.filter(pk=sid).exists())

    def test_cross_company_and_permissions(self):
        supplier = self.supplier()
        Supplier.objects.filter(pk=supplier["id"]).update(company=self.other_company)
        for suffix in ("", "metrics/", "price-history/"):
            self.assertEqual(self.client.get(f"/api/suppliers/{supplier['id']}/{suffix}").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/suppliers/{supplier['id']}/", {"name": "Hack"}, format="json").status_code, 404)
        self.assertEqual(self.client.get("/api/suppliers/").data["count"], 0)
        RolePermission.objects.filter(role=self.role, permission__code__startswith="suppliers.").delete()
        self.assertEqual(self.post("/api/suppliers/", self.supplier_input()).status_code, 403)
        self.assertEqual(self.client.get("/api/suppliers/").status_code, 403)

    def test_real_metrics_orders_prices_payments_and_permission_redaction(self):
        supplier = self.supplier()
        order = self.purchase(supplier)
        self.receipt(order, "10.000")
        payment = self.post("/api/payments/", dict(direction="outgoing", partner_id=supplier["id"], amount="50.00", date=timezone.localdate().isoformat(), method="cash"))
        self.assertEqual(payment.status_code, 201, payment.data)
        detail = self.client.get(f"/api/suppliers/{supplier['id']}/").data
        self.assertEqual(len(detail["orders"]), 1)
        self.assertEqual(len(detail["payments"]), 1)
        metrics = self.client.get(f"/api/suppliers/{supplier['id']}/metrics/").data
        self.assertEqual(metrics["purchaseVolume"], Decimal("215.89"))
        self.assertEqual(metrics["averageLeadTimeDays"], 0)
        self.assertEqual(metrics["onTimeDelivery"], 100)
        self.assertIsNone(metrics["outstandingBalance"])
        self.assertEqual(self.client.get(f"/api/suppliers/{supplier['id']}/price-history/").data["points"][0]["price"], Decimal("19.99"))
        RolePermission.objects.filter(role=self.role, permission__code__in=["purchases.view", "payments.view"]).delete()
        detail = self.client.get(f"/api/suppliers/{supplier['id']}/").data
        self.assertEqual(detail["orders"], [])
        self.assertEqual(detail["payments"], [])
        self.assertIsNone(detail["purchaseVolume"])
        self.assertEqual(self.client.get(f"/api/suppliers/{supplier['id']}/price-history/").status_code, 403)


class PurchaseTests(PurchasingDataMixin, TestCase):
    def test_create_decimal_update_draft_send_confirm_and_immutability(self):
        order = self.purchase(confirmed=False)
        path = f"/api/purchase-orders/{order['id']}/"
        self.assertEqual(order["total"], Decimal("215.89"))
        self.assertEqual(self.client.patch(path, {"notes": "Changed"}, format="json").status_code, 200)
        self.assertEqual(self.client.patch(path, {"lines": [{"product_name": "Incomplete"}]}, format="json").status_code, 400)
        self.assertEqual(self.client.patch(path, {"total": 1}, format="json").status_code, 400)
        self.assertEqual(self.post(path + "send/").status_code, 200)
        self.assertEqual(self.post(path + "send/").status_code, 409)
        self.assertEqual(self.post(path + "confirm/").status_code, 200)
        self.assertEqual(self.post(path + "confirm/").status_code, 409)
        self.assertEqual(self.client.patch(path, {"notes": "No"}, format="json").status_code, 409)
        self.assertEqual(self.post(path + "cancel/").status_code, 200)
        self.assertEqual(self.post(path + "confirm/").status_code, 409)
        self.assertTrue(PurchaseOrder.objects.filter(pk=order["id"]).exists())

    def test_partial_full_receipts_replay_and_cancel_guard(self):
        order = self.purchase()
        first = self.receipt(order, key="receipt-repeat-123")
        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(first.data["receiptStatus"], "partially_received")
        self.assertEqual(first.data["lines"][0]["remainingQuantity"], 6)
        self.assertEqual(self.receipt(order, key="receipt-repeat-123").status_code, 200)
        self.assertEqual(GoodsReceipt.objects.count(), 1)
        self.assertEqual(self.receipt(order, "5.000", key="receipt-repeat-123").status_code, 409)
        self.assertEqual(self.post(f"/api/purchase-orders/{order['id']}/cancel/").status_code, 409)
        result = self.receipt(order, "6.000")
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data["receiptStatus"], "received")
        self.assertEqual(result.data["status"], "confirmed")
        self.assertFalse(result.data["capabilities"]["canReceive"])
        self.assertTrue(result.data["stockIntegrated"])
        self.assertEqual(self.receipt(order, "1.000").status_code, 409)

    def test_receipt_excess_nonpositive_foreign_duplicate_dates_and_rollback(self):
        order, other = self.purchase(), self.purchase()
        self.assertEqual(self.receipt(order, "11.000").status_code, 409)
        self.assertEqual(self.receipt(order, "0.000").status_code, 400)
        self.assertEqual(self.receipt(order, "-1.000").status_code, 400)
        path = f"/api/purchase-orders/{order['id']}/receive/"
        base = dict(date=timezone.localdate().isoformat(), warehouse=self.warehouse.name)
        self.assertEqual(self.post(path, {**base, "lines": [dict(line_id=other["lines"][0]["id"], quantity=1)]}).status_code, 404)
        row = dict(line_id=order["lines"][0]["id"], quantity=1)
        self.assertEqual(self.post(path, {**base, "lines": [row, row]}).status_code, 400)
        self.assertEqual(self.receipt(order, warehouse=self.foreign_warehouse.name).status_code, 400)
        with patch("apps.purchasing.services.activity", side_effect=RuntimeError("failure")):
            with self.assertRaises(RuntimeError):
                self.receipt(order)
        self.assertFalse(GoodsReceipt.objects.exists())
        self.assertFalse(GoodsReceiptLine.objects.exists())
        self.assertEqual(PurchaseOrderLine.objects.get(pk=order["lines"][0]["id"]).received_quantity, 0)

    def test_cross_company_supplier_order_receipt_and_permissions(self):
        order = self.purchase(confirmed=False)
        supplier = self.supplier()
        Supplier.objects.filter(pk=supplier["id"]).update(company=self.other_company)
        path = f"/api/purchase-orders/{order['id']}/"
        self.assertEqual(self.client.patch(path, {"supplier_id": supplier["id"]}, format="json").status_code, 404)
        PurchaseOrder.objects.filter(pk=order["id"]).update(company=self.other_company)
        for suffix in ("confirm/", "send/", "cancel/", "receive/"):
            self.assertEqual(self.post(path + suffix).status_code, 404)
        self.assertEqual(self.client.get(path).status_code, 404)
        self.assertEqual(self.client.get("/api/purchase-orders/").data["count"], 0)
        RolePermission.objects.filter(role=self.role, permission__code__in=["purchases.confirm", "receipts.create"]).delete()
        self.assertEqual(self.post(path + "confirm/").status_code, 403)
        self.assertEqual(self.post(path + "receive/").status_code, 403)

    def test_cancelled_and_draft_orders_cannot_receive(self):
        order = self.purchase(confirmed=False)
        self.assertEqual(self.receipt(order).status_code, 409)
        self.post(f"/api/purchase-orders/{order['id']}/cancel/")
        self.assertEqual(self.receipt(order).status_code, 409)
