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

    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    website = models.URLField(max_length=500, blank=True)
    address = models.CharField(max_length=500, blank=True)
    city = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=2, blank=True)
    # Small, validated logos remain in the same PostgreSQL transaction.
    logo = models.BinaryField(null=True, blank=True)
    logo_mime_type = models.CharField(max_length=30, blank=True)
    settings_version = models.PositiveIntegerField(default=1)

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


class CompanyBusinessProfile(TimeStampedModel):
    company = models.OneToOneField(
        Company, on_delete=models.CASCADE, related_name="business_profile",
    )
    industry = models.CharField(max_length=100)
    business_type = models.CharField(max_length=20)
    main_activity = models.CharField(max_length=255)
    size = models.CharField(max_length=20)
    employee_count = models.PositiveIntegerField(null=True, blank=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "companies_business_profile"


class CompanyFinanceSetting(TimeStampedModel):
    company = models.OneToOneField(
        Company, on_delete=models.CASCADE, related_name="finance_setting",
    )
    # The currency is stored once on Company.
    tax_system = models.CharField(max_length=20)
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2)
    fiscal_year_start = models.DateField()
    fiscal_year_end = models.DateField()
    payment_terms = models.PositiveSmallIntegerField()
    payment_terms_label = models.CharField(max_length=1000, blank=True)

    class Meta:
        db_table = "companies_finance_setting"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(vat_rate__gte=0, vat_rate__lte=100),
                name="company_vat_rate_range",
            ),
            models.CheckConstraint(
                condition=models.Q(fiscal_year_end__gte=models.F("fiscal_year_start")),
                name="company_fiscal_dates_order",
            ),
        ]


class CompanyInvoicingSetting(TimeStampedModel):
    company = models.OneToOneField(
        Company, on_delete=models.CASCADE, related_name="invoicing_setting",
    )
    invoice_prefix = models.CharField(max_length=20)
    invoice_start = models.PositiveIntegerField()
    quote_prefix = models.CharField(max_length=20)
    quote_start = models.PositiveIntegerField()
    purchase_order_prefix = models.CharField(max_length=20)
    payment_terms = models.CharField(max_length=1000)
    footer = models.TextField(blank=True)
    language = models.CharField(max_length=2)
    show_vat = models.BooleanField(default=True)
    default_due_days = models.PositiveSmallIntegerField(default=30)

    class Meta:
        db_table = "companies_invoicing_setting"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(invoice_start__gte=1, invoice_start__lte=999999999),
                name="company_invoice_start_range",
            ),
            models.CheckConstraint(
                condition=models.Q(quote_start__gte=1, quote_start__lte=999999999),
                name="company_quote_start_range",
            ),
        ]


class ModuleDefinition(TimeStampedModel):
    code = models.SlugField(max_length=50, unique=True)
    label = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "companies_module_definition"
        ordering = ["code"]


class CompanyModule(TimeStampedModel):
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="company_modules",
    )
    module = models.ForeignKey(ModuleDefinition, on_delete=models.PROTECT)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "companies_company_module"
        constraints = [
            models.UniqueConstraint(
                fields=["company", "module"], name="unique_company_module",
            ),
        ]


class CompanyGeneralSetting(TimeStampedModel):
    company = models.OneToOneField(Company, on_delete=models.CASCADE, related_name="general_setting")
    language = models.CharField(max_length=2, default="fr")
    date_format = models.CharField(max_length=20, default="DD/MM/YYYY")
    number_format = models.CharField(max_length=20, default="fr-FR")


class CompanySalesSetting(TimeStampedModel):
    company = models.OneToOneField(Company, on_delete=models.CASCADE, related_name="sales_setting")
    order_prefix = models.CharField(max_length=20, default="SO")
    quote_validity_days = models.PositiveSmallIntegerField(default=30)

    class Meta:
        constraints = [models.CheckConstraint(
            condition=models.Q(quote_validity_days__gte=1, quote_validity_days__lte=3650),
            name="company_quote_validity_range",
        )]


class DocumentSequence(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    kind = models.CharField(max_length=20)
    year = models.PositiveSmallIntegerField(default=0)
    next_value = models.PositiveBigIntegerField(default=1)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["company", "kind", "year"], name="unique_document_sequence"),
            models.CheckConstraint(condition=models.Q(next_value__gte=1), name="document_sequence_positive"),
        ]
