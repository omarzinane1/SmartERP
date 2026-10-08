from django.conf import settings
from django.db import models
from common.models import TimeStampedModel, EmailDeliveryState


class QuoteStatus(models.TextChoices):
    DRAFT = "draft", "Brouillon"
    SENT = "sent", "Envoyé"
    VIEWED = "viewed", "Vu"
    ACCEPTED = "accepted", "Accepté"
    REJECTED = "rejected", "Refusé"
    EXPIRED = "expired", "Expiré"


class Quote(TimeStampedModel):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    customer = models.ForeignKey("crm.Customer", on_delete=models.PROTECT, related_name="quotes")
    number = models.CharField(max_length=50)
    status = models.CharField(max_length=20, choices=QuoteStatus.choices, default=QuoteStatus.DRAFT)
    salesperson = models.ForeignKey("accounts.Membership", on_delete=models.PROTECT)
    issue_date = models.DateField()
    expires_at = models.DateField()
    currency = models.CharField(max_length=3, default="MAD")
    billing_address = models.TextField(blank=True)
    payment_terms = models.TextField(blank=True)
    customer_reference = models.CharField(max_length=5000, blank=True)
    subject = models.TextField(blank=True)
    delivery_terms = models.TextField(blank=True)
    commercial_terms = models.TextField(blank=True)
    internal_notes = models.TextField(blank=True)
    customer_notes = models.TextField(blank=True)
    gross_total = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    tax_total = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=18, decimal_places=2, default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="unique_quote_number"),
            models.CheckConstraint(condition=models.Q(expires_at__gte=models.F("issue_date")), name="quote_date_order"),
            models.CheckConstraint(condition=models.Q(status__in=QuoteStatus.values), name="quote_status_valid"),
            models.CheckConstraint(condition=models.Q(total__gte=0, subtotal__gte=0, tax_total__gte=0), name="quote_nonnegative_totals"),
        ]
        indexes = [models.Index(fields=["company", "status", "issue_date"], name="quote_company_status_date"),
                   models.Index(fields=["company", "customer"], name="quote_company_customer")]
        ordering = ["-created_at", "-pk"]


class CommercialLine(models.Model):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    position = models.PositiveSmallIntegerField()
    product = models.ForeignKey("inventory.Product", on_delete=models.PROTECT, null=True, blank=True)
    product_name = models.CharField(max_length=5000, blank=True)
    description = models.TextField(blank=True)
    quantity = models.DecimalField(max_digits=9, decimal_places=3)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    discount_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    gross_total = models.DecimalField(max_digits=18, decimal_places=2)
    discount_total = models.DecimalField(max_digits=18, decimal_places=2)
    subtotal = models.DecimalField(max_digits=18, decimal_places=2)
    tax_total = models.DecimalField(max_digits=18, decimal_places=2)
    line_total = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        abstract = True
        ordering = ["position", "pk"]
        constraints = [
            models.CheckConstraint(condition=models.Q(quantity__gt=0, quantity__lte=100000, unit_price__gte=0, unit_price__lte=1000000), name="%(class)s_quantity_price_range"),
            models.CheckConstraint(condition=models.Q(discount_rate__gte=0, discount_rate__lte=100, tax_rate__gte=0, tax_rate__lte=100), name="%(class)s_rate_range"),
            models.CheckConstraint(condition=models.Q(line_total__gte=0), name="%(class)s_total_positive"),
        ]


class QuoteLine(CommercialLine):
    quote = models.ForeignKey(Quote, on_delete=models.CASCADE, related_name="lines")

    class Meta(CommercialLine.Meta):
        constraints = CommercialLine.Meta.constraints + [
            models.UniqueConstraint(fields=["quote", "position"], name="unique_quote_line_position"),
        ]


class QuoteActivity(models.Model):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    quote = models.ForeignKey(Quote, on_delete=models.CASCADE, related_name="activities")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    description = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-pk"]


class SalesOrderStatus(models.TextChoices):
    DRAFT = "draft", "Brouillon"
    CONFIRMED = "confirmed", "Confirmée"
    PROCESSING = "processing", "En préparation"
    COMPLETED = "completed", "Terminée"
    CANCELLED = "cancelled", "Annulée"


class SalesOrder(TimeStampedModel):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    customer = models.ForeignKey("crm.Customer", on_delete=models.PROTECT, related_name="sales_orders")
    quote = models.OneToOneField(Quote, on_delete=models.PROTECT, null=True, blank=True, related_name="sales_order")
    number = models.CharField(max_length=50)
    status = models.CharField(max_length=20, choices=SalesOrderStatus.choices, default=SalesOrderStatus.DRAFT)
    salesperson = models.ForeignKey("accounts.Membership", on_delete=models.PROTECT)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    currency = models.CharField(max_length=3, default="MAD")
    customer_reference = models.CharField(max_length=5000, blank=True)
    billing_address = models.TextField(blank=True)
    delivery_address = models.TextField(blank=True)
    payment_terms = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    gross_total = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    tax_total = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=18, decimal_places=2, default=0)

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="unique_sales_order_number"),
            models.CheckConstraint(condition=models.Q(status__in=SalesOrderStatus.values), name="sales_order_status_valid"),
            models.CheckConstraint(condition=models.Q(total__gte=0, subtotal__gte=0, tax_total__gte=0), name="sales_order_positive_totals"),
        ]
        indexes = [models.Index(fields=["company", "status"], name="sales_order_company_status"),
                   models.Index(fields=["company", "customer"], name="sales_order_company_customer")]


class SalesOrderLine(CommercialLine):
    order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name="lines")

    class Meta(CommercialLine.Meta):
        constraints = CommercialLine.Meta.constraints + [
            models.UniqueConstraint(fields=["order", "position"], name="unique_sales_order_line_position"),
        ]


class SalesOrderActivity(models.Model):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name="activities")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    type = models.CharField(max_length=20)
    description = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-pk"]


class InvoiceStatus(models.TextChoices):
    DRAFT = "draft", "Brouillon"
    POSTED = "posted", "Comptabilisée"
    CANCELLED = "cancelled", "Annulée"


class Invoice(TimeStampedModel):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    customer = models.ForeignKey("crm.Customer", on_delete=models.PROTECT, related_name="invoices")
    sales_order = models.ForeignKey(SalesOrder, on_delete=models.PROTECT, null=True, blank=True, related_name="invoices")
    salesperson = models.ForeignKey("accounts.Membership", on_delete=models.PROTECT)
    number = models.CharField(max_length=50)
    status = models.CharField(max_length=20, choices=InvoiceStatus.choices, default=InvoiceStatus.DRAFT)
    issue_date = models.DateField()
    due_date = models.DateField()
    issued_at = models.DateTimeField(null=True, blank=True)
    currency = models.CharField(max_length=3, default="MAD")
    billing_address = models.TextField(blank=True)
    payment_terms = models.TextField(blank=True)
    customer_reference = models.CharField(max_length=5000, blank=True)
    notes = models.TextField(blank=True)
    gross_total = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    subtotal = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    tax_total = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    amount_paid = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    credit_total = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    balance_due = models.DecimalField(max_digits=18, decimal_places=2, default=0)

    class Meta:
        ordering = ["-issue_date", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="unique_invoice_number"),
            models.UniqueConstraint(fields=["sales_order"], condition=~models.Q(status="cancelled"), name="one_active_invoice_per_order"),
            models.CheckConstraint(condition=models.Q(due_date__gte=models.F("issue_date")), name="invoice_date_order"),
            models.CheckConstraint(condition=models.Q(status__in=InvoiceStatus.values), name="invoice_status_valid"),
            models.CheckConstraint(condition=models.Q(total__gte=0, subtotal__gte=0, tax_total__gte=0, amount_paid__gte=0, amount_paid__lte=models.F("total")), name="invoice_amounts_valid"),
            models.CheckConstraint(condition=models.Q(balance_due=models.F("total") - models.F("amount_paid") - models.F("credit_total")), name="invoice_balance_consistent"),
            models.CheckConstraint(condition=models.Q(credit_total__gte=0, balance_due__gte=0), name="invoice_credit_balance_positive"),
        ]
        indexes = [models.Index(fields=["company", "status", "issue_date"], name="invoice_company_status_date"),
                   models.Index(fields=["company", "due_date"], name="invoice_company_due"),
                   models.Index(fields=["company", "customer"], name="invoice_company_customer")]


class InvoiceLine(CommercialLine):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="lines")

    class Meta(CommercialLine.Meta):
        constraints = CommercialLine.Meta.constraints + [
            models.UniqueConstraint(fields=["invoice", "position"], name="unique_invoice_line_position"),
        ]


class InvoiceActivity(models.Model):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="activities")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    type = models.CharField(max_length=20)
    description = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-pk"]


class CreditNote(TimeStampedModel):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    customer = models.ForeignKey("crm.Customer", on_delete=models.PROTECT)
    original_invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="credit_notes")
    number = models.CharField(max_length=50)
    date = models.DateField()
    currency = models.CharField(max_length=3)
    reason = models.TextField()
    status = models.CharField(max_length=20, default="posted", editable=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    operation_key = models.CharField(max_length=128)
    request_fingerprint = models.CharField(max_length=64)
    gross_total = models.DecimalField(max_digits=18, decimal_places=2)
    discount_total = models.DecimalField(max_digits=18, decimal_places=2)
    subtotal = models.DecimalField(max_digits=18, decimal_places=2)
    tax_total = models.DecimalField(max_digits=18, decimal_places=2)
    total = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        ordering = ["-date", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="unique_credit_number"),
            models.UniqueConstraint(fields=["company", "operation_key"], name="unique_credit_operation"),
            models.CheckConstraint(condition=models.Q(total__gt=0, subtotal__gte=0, tax_total__gte=0, status="posted"), name="credit_amounts_status_valid"),
        ]
        indexes = [models.Index(fields=["company", "customer", "date"], name="credit_company_customer_date")]


class CreditNoteLine(CommercialLine):
    credit_note = models.ForeignKey(CreditNote, on_delete=models.PROTECT, related_name="lines")
    original_line = models.ForeignKey(InvoiceLine, on_delete=models.PROTECT, related_name="credits")

    class Meta(CommercialLine.Meta):
        constraints = CommercialLine.Meta.constraints + [
            models.UniqueConstraint(fields=["credit_note", "original_line"], name="unique_credit_source_line"),
            models.UniqueConstraint(fields=["credit_note", "position"], name="unique_credit_line_position"),
        ]


class InvoiceReminder(EmailDeliveryState):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="reminders")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    channel = models.CharField(max_length=20, default="email")
    recipient = models.EmailField(blank=True)
    status = models.CharField(max_length=20, default="requested")
    operation_key = models.CharField(max_length=128)
    request_fingerprint = models.CharField(max_length=64)

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["company", "operation_key"], name="unique_reminder_operation"),
            models.CheckConstraint(condition=models.Q(status__in=["requested", "processing", "retrying", "sent", "failed", "skipped", "uncertain"]), name="reminder_delivery_status_valid"),
        ]
