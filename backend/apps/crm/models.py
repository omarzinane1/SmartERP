from django.conf import settings
from django.db import models
from common.models import TimeStampedModel


class CustomerStatus(models.TextChoices):
    ACTIVE = "active", "Actif"
    PROSPECT = "prospect", "Prospect"
    INACTIVE = "inactive", "Inactif"
    ARCHIVED = "archived", "Archivé"
    AT_RISK = "at_risk", "À risque"
    VIP = "vip", "VIP"


class Customer(TimeStampedModel):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT, related_name="customers")
    reference = models.CharField(max_length=50)
    name = models.CharField(max_length=120)
    type = models.CharField(max_length=20, choices=[("company", "Entreprise"), ("individual", "Particulier")])
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(max_length=150)
    city = models.CharField(max_length=60)
    district = models.CharField(max_length=100, blank=True)
    salesperson = models.ForeignKey("accounts.Membership", on_delete=models.PROTECT, null=True, blank=True)
    status = models.CharField(max_length=20, choices=CustomerStatus.choices, default=CustomerStatus.PROSPECT)
    previous_status = models.CharField(max_length=20, choices=CustomerStatus.choices, default=CustomerStatus.PROSPECT)
    tags = models.JSONField(default=list, blank=True)
    country = models.CharField(max_length=2, blank=True)
    industry = models.CharField(max_length=100, blank=True)
    tax_id = models.CharField(max_length=100, blank=True)
    website = models.URLField(blank=True)
    address = models.CharField(max_length=500, blank=True)
    segment = models.CharField(max_length=100, blank=True)
    payment_terms = models.CharField(max_length=1000, blank=True)
    currency = models.CharField(max_length=3, default="MAD")
    preferred_contact = models.CharField(max_length=50, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="created_customers")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["company", "reference"], name="unique_customer_reference"),
            models.CheckConstraint(condition=models.Q(status__in=CustomerStatus.values), name="customer_status_valid"),
        ]
        indexes = [models.Index(fields=["company", "status"], name="customer_company_status"),
                   models.Index(fields=["company", "name"], name="customer_company_name"),
                   models.Index(fields=["company", "city"], name="customer_company_city")]
        ordering = ["-created_at", "-pk"]
