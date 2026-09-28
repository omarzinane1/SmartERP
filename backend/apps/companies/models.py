from django.db import models

from common.models import TimeStampedModel


class Company(TimeStampedModel):
    """
    Represents a company/tenant in SmartERP.

    All business data will eventually be scoped
    to a Company.
    """

    name = models.CharField(
        max_length=255,
    )

    legal_name = models.CharField(
        max_length=255,
        blank=True,
    )

    tax_id = models.CharField(
        max_length=100,
        blank=True,
    )

    currency = models.CharField(
        max_length=3,
        default="MAD",
    )

    timezone = models.CharField(
        max_length=50,
        default="Africa/Casablanca",
    )

    onboarding_completed = models.BooleanField(
        default=False,
    )

    is_active = models.BooleanField(
        default=True,
    )

    class Meta:
        db_table = "companies_company"
        ordering = ["name"]

    def __str__(self):
        return self.name