from django.conf import settings
from django.db import models
from common.models import TimeStampedModel
from apps.sales.models import CommercialLine


class Supplier(TimeStampedModel):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    reference = models.CharField(max_length=50)
    name = models.CharField(max_length=150)
    contact = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    category = models.CharField(max_length=80)
    country = models.CharField(max_length=80)
    city = models.CharField(max_length=80)
    buyer = models.ForeignKey("accounts.Membership", on_delete=models.PROTECT)
    status = models.CharField(max_length=20, default="active", choices=[(s, s) for s in ("active", "inactive", "blocked", "archived")])
    strategic = models.BooleanField(default=False)

    class Meta:
        ordering = ["name", "pk"]
        constraints = [
            models.UniqueConstraint(fields=["company", "reference"], name="unique_supplier_reference"),
            models.CheckConstraint(condition=models.Q(status__in=["active", "inactive", "blocked", "archived"]), name="supplier_status_valid"),
        ]
        indexes = [models.Index(fields=["company", "status"], name="supplier_company_status")]


class PurchaseOrder(TimeStampedModel):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="orders")
    number = models.CharField(max_length=50)
    status = models.CharField(max_length=20, default="draft", choices=[(s, s) for s in ("draft", "sent", "confirmed", "cancelled")])
    date = models.DateField()
    expected_date = models.DateField()
    currency = models.CharField(max_length=3, default="MAD")
    buyer = models.ForeignKey("accounts.Membership", on_delete=models.PROTECT)
    warehouse = models.ForeignKey("inventory.Warehouse", on_delete=models.PROTECT)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    sent_at = models.DateTimeField(null=True)
    confirmed_at = models.DateTimeField(null=True)
    cancelled_at = models.DateTimeField(null=True)
    gross_total = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    tax_total = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=18, decimal_places=2, default=0)

    class Meta:
        ordering = ["-date", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="unique_purchase_number"),
            models.CheckConstraint(condition=models.Q(expected_date__gte=models.F("date")), name="purchase_dates_valid"),
            models.CheckConstraint(condition=models.Q(total__gt=0, subtotal__gte=0, tax_total__gte=0), name="purchase_totals_valid"),
            models.CheckConstraint(condition=models.Q(status__in=["draft", "sent", "confirmed", "cancelled"]), name="purchase_status_valid"),
        ]
        indexes = [models.Index(fields=["company", "status", "date"], name="purchase_company_status_date"),
                   models.Index(fields=["company", "supplier"], name="purchase_company_supplier")]


class PurchaseOrderLine(CommercialLine):
    order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="lines")
    received_quantity = models.DecimalField(max_digits=9, decimal_places=3, default=0)

    class Meta(CommercialLine.Meta):
        constraints = CommercialLine.Meta.constraints + [
            models.UniqueConstraint(fields=["order", "position"], name="unique_purchase_line_position"),
            models.CheckConstraint(condition=models.Q(received_quantity__gte=0, received_quantity__lte=models.F("quantity")), name="purchase_received_valid"),
        ]


class GoodsReceipt(TimeStampedModel):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    order = models.ForeignKey(PurchaseOrder, on_delete=models.PROTECT, related_name="receipts")
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT)
    number = models.CharField(max_length=50)
    date = models.DateField()
    warehouse = models.ForeignKey("inventory.Warehouse", on_delete=models.PROTECT)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    operation_key = models.CharField(max_length=128)
    request_fingerprint = models.CharField(max_length=64)
    stock_applied_at = models.DateTimeField(null=True)

    class Meta:
        ordering = ["date", "pk"]
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="unique_receipt_number"),
            models.UniqueConstraint(fields=["company", "operation_key"], name="unique_receipt_operation"),
        ]
        indexes = [models.Index(fields=["company", "supplier", "date"], name="receipt_company_supplier_date")]


class GoodsReceiptLine(models.Model):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    receipt = models.ForeignKey(GoodsReceipt, on_delete=models.PROTECT, related_name="lines")
    order_line = models.ForeignKey(PurchaseOrderLine, on_delete=models.PROTECT, related_name="receipt_lines")
    quantity = models.DecimalField(max_digits=9, decimal_places=3)

    class Meta:
        ordering = ["pk"]
        constraints = [
            models.UniqueConstraint(fields=["receipt", "order_line"], name="unique_receipt_order_line"),
            models.CheckConstraint(condition=models.Q(quantity__gt=0), name="receipt_quantity_positive"),
        ]


class PurchaseActivity(models.Model):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    order = models.ForeignKey(PurchaseOrder, on_delete=models.PROTECT, related_name="activities")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    title = models.CharField(max_length=100)
    detail = models.CharField(max_length=255)

    class Meta:
        ordering = ["-created_at", "-pk"]


class SupplierInvoice(TimeStampedModel):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="invoices")
    order = models.ForeignKey(PurchaseOrder, on_delete=models.PROTECT, null=True, related_name="invoices")
    number = models.CharField(max_length=50)
    supplier_reference = models.CharField(max_length=120, blank=True)
    issue_date = models.DateField()
    due_date = models.DateField()
    currency = models.CharField(max_length=3, default="MAD")
    payment_terms = models.CharField(max_length=500, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, default="draft", choices=[(s, s) for s in ("draft", "posted", "cancelled")])
    gross_total = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    tax_total = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=18, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    balance_due = models.DecimalField(max_digits=18, decimal_places=2)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    posted_at = models.DateTimeField(null=True)
    operation_key = models.CharField(max_length=128)
    request_fingerprint = models.CharField(max_length=64)

    class Meta:
        ordering = ["-issue_date", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="unique_supplier_invoice_number"),
            models.UniqueConstraint(fields=["company", "operation_key"], name="unique_supplier_invoice_op"),
            models.UniqueConstraint(fields=["company", "supplier", "supplier_reference"], condition=~models.Q(supplier_reference="") & ~models.Q(status="cancelled"), name="unique_supplier_external_ref"),
            models.CheckConstraint(condition=models.Q(total__gt=0, amount_paid__gte=0, balance_due__gte=0, balance_due=models.F("total")-models.F("amount_paid")), name="supplier_invoice_balance_valid"),
            models.CheckConstraint(condition=models.Q(due_date__gte=models.F("issue_date")), name="supplier_invoice_dates_valid"),
            models.CheckConstraint(condition=models.Q(status__in=["draft", "posted", "cancelled"]), name="supplier_invoice_status_valid"),
        ]
        indexes = [models.Index(fields=["company", "status", "due_date"], name="supinvoice_company_status_due"), models.Index(fields=["company", "supplier"], name="supinvoice_company_supplier")]


class SupplierInvoiceLine(CommercialLine):
    invoice = models.ForeignKey(SupplierInvoice, on_delete=models.CASCADE, related_name="lines")
    purchase_line = models.ForeignKey(PurchaseOrderLine, on_delete=models.PROTECT, null=True, related_name="invoice_lines")

    class Meta(CommercialLine.Meta):
        constraints = CommercialLine.Meta.constraints + [
            models.UniqueConstraint(fields=["invoice", "position"], name="unique_supinvoice_line_position"),
            models.UniqueConstraint(fields=["invoice", "purchase_line"], condition=models.Q(purchase_line__isnull=False), name="unique_supinvoice_purchase_line"),
        ]


class SupplierInvoiceActivity(models.Model):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    invoice = models.ForeignKey(SupplierInvoice, on_delete=models.PROTECT, related_name="activities")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    title = models.CharField(max_length=100)
    detail = models.CharField(max_length=255)

    class Meta:
        ordering = ["-created_at", "-pk"]
