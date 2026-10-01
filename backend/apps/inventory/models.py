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
