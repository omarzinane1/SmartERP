from django.conf import settings
from django.db import models
from common.models import TimeStampedModel


class ApprovalRequest(TimeStampedModel):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    number = models.CharField(max_length=50)
    workflow_type = models.CharField(max_length=30, choices=[("expense", "Dépense"), ("purchase_review", "Revue achat")])
    expense = models.ForeignKey("finance.Expense", on_delete=models.PROTECT, null=True, related_name="approval_requests")
    purchase_order = models.ForeignKey("purchasing.PurchaseOrder", on_delete=models.PROTECT, null=True, related_name="approval_requests")
    status = models.CharField(max_length=20, default="pending", choices=[(s, s) for s in ("pending", "approved", "rejected", "cancelled")])
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="requested_approvals")
    requested_at = models.DateTimeField()
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, related_name="decided_approvals")
    decided_at = models.DateTimeField(null=True)
    comment = models.CharField(max_length=2000, blank=True)
    source_updated_at = models.DateTimeField()
    version = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["-requested_at", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="unique_approval_number"),
            models.UniqueConstraint(fields=["company", "expense"], condition=models.Q(status="pending", expense__isnull=False), name="unique_pending_expense_approval"),
            models.UniqueConstraint(fields=["company", "purchase_order"], condition=models.Q(status="pending", purchase_order__isnull=False), name="unique_pending_purchase_review"),
            models.CheckConstraint(condition=models.Q(workflow_type="expense", expense__isnull=False, purchase_order__isnull=True) | models.Q(workflow_type="purchase_review", purchase_order__isnull=False, expense__isnull=True), name="approval_target_valid"),
            models.CheckConstraint(condition=models.Q(status__in=["pending", "approved", "rejected", "cancelled"], version__gte=1), name="approval_state_valid"),
        ]
        indexes = [models.Index(fields=["company", "status", "requested_at"], name="approval_company_status_date")]
