from django.conf import settings
from django.db import models
from common.models import EmailDeliveryState

EMAIL_STATUSES = ["pending", "processing", "retrying", "sent", "failed", "skipped", "uncertain"]


class Notification(EmailDeliveryState):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    type = models.CharField(max_length=40)
    title = models.CharField(max_length=180)
    message = models.CharField(max_length=1000)
    entity_type = models.CharField(max_length=30)
    entity_id = models.PositiveBigIntegerField()
    warehouse = models.ForeignKey("inventory.Warehouse", null=True, on_delete=models.PROTECT)
    required_permissions = models.JSONField(default=list)
    dedupe_key = models.CharField(max_length=160)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    email_status = models.CharField(max_length=20, default="pending", choices=[(s, s) for s in EMAIL_STATUSES])

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [models.UniqueConstraint(fields=["company", "recipient", "dedupe_key"], name="notification_recipient_event"), models.CheckConstraint(condition=models.Q(email_status__in=EMAIL_STATUSES), name="notification_email_status_valid")]
        indexes = [models.Index(fields=["company", "recipient", "is_read", "created_at"], name="notification_recipient_unread")]
