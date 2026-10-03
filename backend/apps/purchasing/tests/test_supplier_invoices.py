from decimal import Decimal
from unittest.mock import patch
from django.test import TestCase
from django.utils import timezone
from apps.accounts.models import RolePermission
from apps.inventory.tests.support import InventoryDataMixin
from apps.purchasing.models import Supplier, SupplierInvoice, SupplierInvoiceLine
from apps.finance.models import PaymentAllocation


class SupplierInvoiceTests(InventoryDataMixin, TestCase):
    def data(self, **changes):
        return dict(supplier_id=self.supplier()["id"], supplier_reference="EXT-1", invoice_date=timezone.localdate().isoformat(),
            due_date=timezone.localdate().isoformat(), currency="MAD", payment_terms="", notes="",
            lines=[dict(product_name="Service", description="", quantity="1.250", unit_price="19.99", discount_rate="10.00", tax_rate="20.00")], **changes)

    def create(self, **changes):
        values = self.data()
        values.update(changes)
        result = self.post("/api/supplier-invoices/", values)
        self.assertEqual(result.status_code, 201, result.data)
        return result.data

    def test_create_list_detail_update_post_lock_and_decimal(self):
        invoice = self.create()
        self.assertEqual(invoice["total"], Decimal("26.99"))
        path = f"/api/supplier-invoices/{invoice['id']}/"
        self.assertEqual(self.client.get(path).status_code, 200)
        self.assertEqual(self.client.get("/api/supplier-invoices/?search=EXT").data["count"], 1)
        self.assertEqual(self.client.patch(path, {"notes": "Updated"}, format="json").status_code, 200)
        self.assertEqual(self.post(path+"post/").status_code, 200)
        self.assertEqual(self.client.patch(path, {"notes": "Locked"}, format="json").status_code, 409)
        self.assertEqual(self.post(path+"post/").status_code, 409)

    def test_foreign_supplier_product_order_and_permissions(self):
        values = self.data()
        foreign = Supplier.objects.create(company=self.other_company, reference="FS", name="Foreign", category="Parts", country="Maroc", city="Fès", buyer=self.other_membership)
        self.assertEqual(self.post("/api/supplier-invoices/", {**values, "supplier_id": foreign.pk}).status_code, 404)
        self.assertEqual(self.post("/api/supplier-invoices/", {**values, "order_id": 999999}).status_code, 404)
        self.assertEqual(self.post("/api/supplier-invoices/", {**values, "lines": [{**values["lines"][0], "product_id": 999999}]}).status_code, 404)
        self.user.is_superuser = True
        self.user.save()
        RolePermission.objects.filter(role=self.role, permission__code__startswith="supplier_invoices.").delete()
        self.assertEqual(self.post("/api/supplier-invoices/", values).status_code, 403)
        self.assertEqual(self.client.get("/api/supplier-invoices/").status_code, 403)

    def test_invalid_lines_total_fields_empty_dates_and_duplicate_reference(self):
        values = self.data()
        for changes in ({"lines": []}, {"total": 1}, {"company_id": self.other_company.pk}, {"lines": [{**values["lines"][0], "quantity": "0"}]}, {"lines": [{**values["lines"][0], "unit_price": "1.123"}]}):
            self.assertEqual(self.post("/api/supplier-invoices/", {**values, **changes}).status_code, 403 if "company_id" in changes else 400)
        self.assertEqual(self.post("/api/supplier-invoices/", values, key="supplier-invoice-once").status_code, 201)
        self.assertEqual(self.post("/api/supplier-invoices/", values, key="supplier-invoice-once").status_code, 201)
        self.assertEqual(self.post("/api/supplier-invoices/", values).status_code, 409)
        self.assertEqual(SupplierInvoice.objects.count(), 1)

    def test_purchase_receipt_bill_snapshot_and_double_billing_guard(self):
        p = self.product()
        order = self.purchase(confirmed=False)
        lines = [{**{k: v for k, v in dict(product_name="Snapshot", description="", quantity="10.000", unit_price="120.00", discount_rate="0.00", tax_rate="20.00").items()}, "product_id": p["id"]}]
        self.client.patch(f"/api/purchase-orders/{order['id']}/", {"lines": lines}, format="json")
        order = self.post(f"/api/purchase-orders/{order['id']}/confirm/").data
        self.assertEqual(self.receipt(order, "4.000").status_code, 200)
        billed = self.post(f"/api/purchase-orders/{order['id']}/bill/", key="bill-once")
        self.assertEqual(billed.status_code, 201, billed.data)
        self.assertEqual(billed.data["total"], 576)
        self.assertEqual(billed.data["orderId"], order["id"])
        self.assertEqual(self.post(f"/api/purchase-orders/{order['id']}/bill/", key="bill-once").data["id"], billed.data["id"])
        self.assertEqual(self.post(f"/api/purchase-orders/{order['id']}/bill/").status_code, 409)
        self.client.patch(f"/api/products/{p['id']}/", {"purchase_price": "140.00"}, format="json")
        path = f"/api/supplier-invoices/{billed.data['id']}/"
        self.assertEqual(self.post(path+"post/").status_code, 400)
        self.assertEqual(self.client.patch(path, {"supplier_reference": "SUP-DOC"}, format="json").status_code, 200)
        self.assertEqual(self.post(path+"post/").status_code, 200)
        self.assertEqual(self.client.get(path).data["lines"][0]["unitPrice"], 120)

    def test_outgoing_partial_payment_allocation_cancel_and_balance(self):
        invoice = self.create()
        path = f"/api/supplier-invoices/{invoice['id']}/"
        self.post(path+"post/")
        paid = self.post(path+"payment/", dict(date=timezone.localdate().isoformat(), amount="10.00", method="cash", reference="R", note=""), key="supplier-pay-once")
        self.assertEqual(paid.status_code, 200, paid.data)
        self.assertEqual((paid.data["paidAmount"], paid.data["balanceDue"]), (10, Decimal("16.99")))
        allocation = PaymentAllocation.objects.get(supplier_invoice_id=invoice["id"])
        self.assertIsNone(allocation.invoice_id)
        self.assertEqual(self.post(f"/api/payments/{allocation.payment_id}/cancel/").status_code, 200)
        result = self.client.get(path).data
        self.assertEqual((result["paidAmount"], result["balanceDue"]), (0, Decimal("26.99")))
        allocation.refresh_from_db()
        self.assertIsNotNone(allocation.reversed_at)

    def test_creation_rollback_and_foreign_detail(self):
        values = self.data()
        with patch("apps.purchasing.invoice_services.invoice_activity", side_effect=RuntimeError("late failure")):
            with self.assertRaises(RuntimeError):
                self.post("/api/supplier-invoices/", values)
        self.assertFalse(SupplierInvoice.objects.exists())
        self.assertFalse(SupplierInvoiceLine.objects.exists())
        invoice = self.create()
        SupplierInvoice.objects.filter(pk=invoice["id"]).update(company=self.other_company)
        self.assertEqual(self.client.get(f"/api/supplier-invoices/{invoice['id']}/").status_code, 404)
        self.assertEqual(self.post(f"/api/supplier-invoices/{invoice['id']}/post/").status_code, 404)
