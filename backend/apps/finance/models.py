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
    invoice = models.ForeignKey("sales.Invoice", on_delete=models.PROTECT, related_name="allocations")
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
        ]
        indexes = [models.Index(fields=["company", "invoice"], name="allocation_company_invoice")]
