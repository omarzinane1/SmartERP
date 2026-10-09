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


class BusinessEmail(EmailDeliveryState):
    TYPES = ["invoice", "invoice_reminder", "quote", "purchase_order", "payment_confirmation", "approval_requested", "approval_approved", "approval_rejected", "notification"]
    STATUSES = ["pending", "sending", "retrying", "sent", "failed", "skipped", "uncertain"]
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    email_type = models.CharField(max_length=30, choices=[(s, s) for s in TYPES])
    entity_type = models.CharField(max_length=30)
    entity_id = models.PositiveBigIntegerField()
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT, related_name="requested_business_emails")
    recipient_user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT, related_name="received_business_emails")
    # Snapshots for traceability only. The worker reloads the current recipient and content.
    recipient = models.EmailField(blank=True)
    subject = models.CharField(max_length=250, blank=True)
    status = models.CharField(max_length=12, default="pending", choices=[(s, s) for s in STATUSES])
    dedupe_key = models.CharField(max_length=180)
    notification = models.OneToOneField(Notification, null=True, on_delete=models.PROTECT, related_name="business_email")
    reminder = models.OneToOneField("sales.InvoiceReminder", null=True, on_delete=models.PROTECT, related_name="business_email")
    backend = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    failed_at = models.DateTimeField(null=True)
    error_message = models.CharField(max_length=250, blank=True)

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [models.UniqueConstraint(fields=["company", "dedupe_key"], name="business_email_company_event"),
            models.CheckConstraint(condition=models.Q(status__in=["pending", "sending", "retrying", "sent", "failed", "skipped", "uncertain"]), name="business_email_status_valid"),
            models.CheckConstraint(condition=~models.Q(status="sent") | models.Q(email_sent_at__isnull=False), name="business_email_sent_timestamp")]
        indexes = [models.Index(fields=["company", "entity_type", "entity_id", "created_at"], name="business_email_entity_time"), models.Index(fields=["status", "email_started_at"], name="business_email_status_started")]
