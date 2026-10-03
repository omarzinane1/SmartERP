from django.conf import settings
from django.db import models

from common.models import TimeStampedModel


class Warehouse(TimeStampedModel):
    company = models.ForeignKey(
        "companies.Company", on_delete=models.CASCADE, related_name="warehouses",
    )
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)
    address = models.CharField(max_length=500, blank=True)
    is_active = models.BooleanField(default=True)
    city = models.CharField(max_length=80, blank=True)
    country = models.CharField(max_length=80, blank=True)
    manager = models.CharField(max_length=150, blank=True)
    capacity = models.PositiveIntegerField(null=True)
    capacity_unit = models.CharField(max_length=30, default="unités")

    class Meta:
        db_table = "inventory_warehouse"
        constraints = [
            models.UniqueConstraint(
                fields=["company", "code"], name="unique_warehouse_code_per_company",
            ),
        ]


class CompanyInventorySetting(TimeStampedModel):
    company = models.OneToOneField(
        "companies.Company", on_delete=models.CASCADE, related_name="inventory_setting",
    )
    enabled = models.BooleanField(default=False)
    multi_warehouse = models.BooleanField(default=False)
    valuation_method = models.CharField(max_length=30, default="weighted_average")
    low_stock_alerts = models.BooleanField(default=True)
    default_unit = models.CharField(max_length=20, default="unit")

    class Meta:
        db_table = "inventory_company_setting"


class Product(TimeStampedModel):
    """Commercial catalog; quantities and valuation belong to the stock ledger."""
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    reference = models.CharField(max_length=60)
    name = models.CharField(max_length=255)
    kind = models.CharField(max_length=10, choices=[("product", "Produit"), ("service", "Service")], default="product")
    description = models.TextField(blank=True)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    category = models.ForeignKey("ProductCategory", on_delete=models.PROTECT, null=True, related_name="products")
    unit = models.ForeignKey("UnitOfMeasure", on_delete=models.PROTECT, null=True, related_name="products")
    supplier = models.ForeignKey("purchasing.Supplier", on_delete=models.PROTECT, null=True, related_name="products")
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    barcode = models.CharField(max_length=80, blank=True)
    minimum_stock = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    maximum_stock = models.DecimalField(max_digits=12, decimal_places=3, default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["company", "reference"], name="unique_product_reference"),
            models.CheckConstraint(condition=models.Q(unit_price__gte=0, unit_price__lte=1000000), name="product_price_range"),
            models.CheckConstraint(condition=models.Q(tax_rate__gte=0, tax_rate__lte=100), name="product_tax_range"),
            models.CheckConstraint(condition=models.Q(purchase_price__gte=0, purchase_price__lte=1000000), name="product_purchase_price_range"),
            models.CheckConstraint(condition=models.Q(minimum_stock__gte=0) & (models.Q(maximum_stock=0) | models.Q(maximum_stock__gte=models.F("minimum_stock"))), name="product_stock_threshold_valid"),
        ]
        indexes = [models.Index(fields=["company", "is_active"], name="product_company_active")]


class ProductCategory(TimeStampedModel):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    name = models.CharField(max_length=80)
    code = models.CharField(max_length=80)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name", "pk"]
        constraints = [models.UniqueConstraint(fields=["company", "name"], name="unique_product_category_name"), models.UniqueConstraint(fields=["company", "code"], name="unique_product_category_code")]


class UnitOfMeasure(TimeStampedModel):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    name = models.CharField(max_length=30)
    code = models.CharField(max_length=30)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name", "pk"]
        constraints = [models.UniqueConstraint(fields=["company", "name"], name="unique_unit_name"), models.UniqueConstraint(fields=["company", "code"], name="unique_unit_code")]


class ProductPriceRecord(models.Model):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="price_records")
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2)
    selling_price = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)

    class Meta:
        ordering = ["created_at", "pk"]
        indexes = [models.Index(fields=["company", "product", "created_at"], name="price_company_product_date")]


class StockLevel(TimeStampedModel):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="stock_levels")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="stock_levels")
    quantity_on_hand = models.DecimalField(max_digits=18, decimal_places=3, default=0)
    total_value = models.DecimalField(max_digits=24, decimal_places=6, default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["company", "warehouse", "product"], name="unique_warehouse_product_stock"),
            models.CheckConstraint(condition=models.Q(quantity_on_hand__gte=0, total_value__gte=0), name="stock_nonnegative"),
            models.CheckConstraint(condition=models.Q(quantity_on_hand__gt=0) | models.Q(total_value=0), name="empty_stock_zero_value"),
        ]
        indexes = [models.Index(fields=["company", "product"], name="stock_company_product")]


class StockMovement(models.Model):
    TYPES = ("receipt", "issue", "adjustment_in", "adjustment_out", "transfer_in", "transfer_out", "return")
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="movements")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="movements")
    number = models.CharField(max_length=50)
    movement_type = models.CharField(max_length=20, choices=[(s, s) for s in TYPES])
    date = models.DateField()
    quantity = models.DecimalField(max_digits=18, decimal_places=3)
    unit_cost = models.DecimalField(max_digits=18, decimal_places=6)
    value_delta = models.DecimalField(max_digits=24, decimal_places=6)
    quantity_before = models.DecimalField(max_digits=18, decimal_places=3)
    quantity_after = models.DecimalField(max_digits=18, decimal_places=3)
    value_before = models.DecimalField(max_digits=24, decimal_places=6)
    value_after = models.DecimalField(max_digits=24, decimal_places=6)
    source_reference = models.CharField(max_length=150, blank=True)
    note = models.TextField(blank=True)
    receipt_line = models.OneToOneField("purchasing.GoodsReceiptLine", on_delete=models.PROTECT, null=True, related_name="stock_movement")
    transfer_line = models.ForeignKey("StockTransferLine", on_delete=models.PROTECT, null=True, related_name="movements")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    operation_key = models.CharField(max_length=128)
    request_fingerprint = models.CharField(max_length=64)

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="unique_movement_number"),
            models.UniqueConstraint(fields=["company", "operation_key"], name="unique_movement_operation"),
            models.UniqueConstraint(fields=["transfer_line", "movement_type"], condition=models.Q(transfer_line__isnull=False), name="unique_transfer_line_movement"),
            models.CheckConstraint(condition=~models.Q(quantity=0) & models.Q(unit_cost__gte=0, quantity_before__gte=0, quantity_after__gte=0, value_before__gte=0, value_after__gte=0), name="movement_values_valid"),
            models.CheckConstraint(condition=models.Q(quantity_after=models.F("quantity_before")+models.F("quantity"), value_after=models.F("value_before")+models.F("value_delta")), name="movement_balance_valid"),
            models.CheckConstraint(condition=models.Q(movement_type__in=["receipt", "adjustment_in", "transfer_in", "return"], quantity__gt=0, value_delta__gte=0) | models.Q(movement_type__in=["issue", "adjustment_out", "transfer_out"], quantity__lt=0, value_delta__lte=0), name="movement_direction_valid"),
        ]
        indexes = [models.Index(fields=["company", "warehouse", "date"], name="movement_company_wh_date"), models.Index(fields=["company", "product", "date"], name="movement_company_product_date")]


class StockTransfer(TimeStampedModel):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    source_warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="outgoing_transfers")
    destination_warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="incoming_transfers")
    number = models.CharField(max_length=50)
    status = models.CharField(max_length=20, default="draft", choices=[(s, s) for s in ("draft", "ready", "in_transit", "completed", "cancelled")])
    date = models.DateField()
    reference_external = models.CharField(max_length=150, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    completed_at = models.DateTimeField(null=True)
    operation_key = models.CharField(max_length=128)
    request_fingerprint = models.CharField(max_length=64)

    class Meta:
        ordering = ["-date", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="unique_transfer_number"),
            models.UniqueConstraint(fields=["company", "operation_key"], name="unique_transfer_operation"),
            models.CheckConstraint(condition=~models.Q(source_warehouse=models.F("destination_warehouse")), name="transfer_warehouses_different"),
            models.CheckConstraint(condition=models.Q(status__in=["draft", "ready", "in_transit", "completed", "cancelled"]), name="transfer_status_valid"),
        ]
        indexes = [models.Index(fields=["company", "status", "date"], name="transfer_company_status_date")]


class StockTransferLine(models.Model):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    transfer = models.ForeignKey(StockTransfer, on_delete=models.CASCADE, related_name="lines")
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)

    class Meta:
        ordering = ["pk"]
        constraints = [models.UniqueConstraint(fields=["transfer", "product"], name="unique_transfer_product"), models.CheckConstraint(condition=models.Q(quantity__gt=0), name="transfer_quantity_positive")]


class StockTransferActivity(models.Model):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    transfer = models.ForeignKey(StockTransfer, on_delete=models.PROTECT, related_name="activities")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    title = models.CharField(max_length=100)
    detail = models.CharField(max_length=255)

    class Meta:
        ordering = ["-created_at", "-pk"]
