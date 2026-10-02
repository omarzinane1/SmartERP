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
    """Commercial catalog foundation only; no stock or movement engine."""
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    reference = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    kind = models.CharField(max_length=10, choices=[("product", "Produit"), ("service", "Service")], default="product")
    description = models.TextField(blank=True)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["company", "reference"], name="unique_product_reference"),
            models.CheckConstraint(condition=models.Q(unit_price__gte=0, unit_price__lte=1000000), name="product_price_range"),
            models.CheckConstraint(condition=models.Q(tax_rate__gte=0, tax_rate__lte=100), name="product_tax_range"),
        ]
