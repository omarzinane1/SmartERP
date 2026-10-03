from django.conf import settings
from django.db import models
from common.models import TimeStampedModel


class Payment(TimeStampedModel):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    number = models.CharField(max_length=50)
    direction = models.CharField(max_length=10, choices=[("incoming", "Encaissement"), ("outgoing", "Décaissement")])
    customer = models.ForeignKey("crm.Customer", on_delete=models.PROTECT, null=True, related_name="payments")
    supplier = models.ForeignKey("purchasing.Supplier", on_delete=models.PROTECT, null=True, related_name="payments")
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=3)
    date = models.DateField()
    method = models.CharField(max_length=20, choices=[(s, s) for s in ("bank_transfer", "cash", "card", "cheque", "other")])
    status = models.CharField(max_length=20, default="completed", choices=[(s, s) for s in ("pending", "completed", "cancelled", "failed")])
    reference_external = models.CharField(max_length=150, blank=True)
    note = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="recorded_payments")
    cancelled_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, related_name="cancelled_payments")
    cancelled_at = models.DateTimeField(null=True)
    operation_key = models.CharField(max_length=128)
    request_fingerprint = models.CharField(max_length=64)

    class Meta:
        ordering = ["-date", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="unique_payment_number"),
            models.UniqueConstraint(fields=["company", "operation_key"], name="unique_payment_operation"),
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="payment_amount_positive"),
            models.CheckConstraint(condition=models.Q(direction="incoming", customer__isnull=False, supplier__isnull=True) | models.Q(direction="outgoing", supplier__isnull=False, customer__isnull=True), name="payment_direction_partner"),
            models.CheckConstraint(condition=models.Q(status__in=["pending", "completed", "cancelled", "failed"]), name="payment_status_valid"),
            models.CheckConstraint(condition=models.Q(method__in=["bank_transfer", "cash", "card", "cheque", "other"]), name="payment_method_valid"),
        ]
        indexes = [models.Index(fields=["company", "status", "date"], name="payment_company_status_date"),
                   models.Index(fields=["company", "customer"], name="payment_company_customer"),
                   models.Index(fields=["company", "supplier"], name="payment_company_supplier")]


class PaymentAllocation(models.Model):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    payment = models.ForeignKey(Payment, on_delete=models.PROTECT, related_name="allocations")
    invoice = models.ForeignKey("sales.Invoice", on_delete=models.PROTECT, null=True, related_name="allocations")
    supplier_invoice = models.ForeignKey("purchasing.SupplierInvoice", on_delete=models.PROTECT, null=True, related_name="allocations")
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    reversed_at = models.DateTimeField(null=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    operation_key = models.CharField(max_length=128)
    request_fingerprint = models.CharField(max_length=64)

    class Meta:
        ordering = ["pk"]
        constraints = [
            models.UniqueConstraint(fields=["company", "operation_key"], name="unique_allocation_operation"),
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="allocation_amount_positive"),
            models.CheckConstraint(condition=models.Q(invoice__isnull=False, supplier_invoice__isnull=True) | models.Q(invoice__isnull=True, supplier_invoice__isnull=False), name="allocation_exactly_one_invoice"),
        ]
        indexes = [models.Index(fields=["company", "invoice"], name="allocation_company_invoice")]


class Expense(TimeStampedModel):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    number = models.CharField(max_length=50)
    date = models.DateField()
    description = models.CharField(max_length=300)
    category = models.CharField(max_length=80)
    supplier = models.ForeignKey("purchasing.Supplier", on_delete=models.PROTECT, null=True, related_name="expenses")
    employee = models.CharField(max_length=120)
    amount_ht = models.DecimalField(max_digits=12, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3)
    note = models.TextField(blank=True)
    status = models.CharField(max_length=20, default="draft", choices=[(s, s) for s in ("draft", "submitted", "approved", "rejected", "paid")])
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_expenses")
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, related_name="submitted_expenses")
    submitted_at = models.DateTimeField(null=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, related_name="approved_expenses")
    approved_at = models.DateTimeField(null=True)
    rejected_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, related_name="rejected_expenses")
    rejected_at = models.DateTimeField(null=True)
    rejection_reason = models.CharField(max_length=500, blank=True)
    paid_date = models.DateField(null=True)
    operation_key = models.CharField(max_length=128)
    request_fingerprint = models.CharField(max_length=64)

    class Meta:
        ordering = ["-date", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="unique_expense_number"),
            models.UniqueConstraint(fields=["company", "operation_key"], name="unique_expense_operation"),
            models.CheckConstraint(condition=models.Q(amount_ht__gt=0, tax_rate__gte=0, tax_rate__lte=100, tax_amount__gte=0, total=models.F("amount_ht")+models.F("tax_amount")), name="expense_totals_valid"),
            models.CheckConstraint(condition=models.Q(status__in=["draft", "submitted", "approved", "rejected", "paid"]), name="expense_status_valid"),
        ]
        indexes = [models.Index(fields=["company", "status", "date"], name="expense_company_status_date"), models.Index(fields=["company", "supplier"], name="expense_company_supplier")]
