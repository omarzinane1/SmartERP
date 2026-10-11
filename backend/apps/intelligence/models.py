from django.conf import settings
from django.db import models
from .constants import STATUSES, SEVERITIES


class IntelligenceRun(models.Model):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    status = models.CharField(max_length=12, default="pending", choices=[(s, s) for s in ["pending", "running", "completed", "failed"]])
    rules = models.JSONField(default=list)
    summary = models.JSONField(default=dict)
    error_code = models.CharField(max_length=40, blank=True)
    error_message = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True)
    completed_at = models.DateTimeField(null=True)
    lease_expires_at = models.DateTimeField()
    claim_token = models.UUIDField(null=True)

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["company"], condition=models.Q(status__in=["pending", "running"]), name="intelligence_one_active_run"),
            models.CheckConstraint(condition=models.Q(status__in=["pending", "running", "completed", "failed"]), name="intelligence_run_status"),
            models.CheckConstraint(condition=~models.Q(status__in=["completed", "failed"]) | models.Q(completed_at__isnull=False), name="intelligence_run_finished"),
        ]
        indexes = [models.Index(fields=["company", "requested_by", "created_at"], name="intelligence_run_owner"), models.Index(fields=["status", "lease_expires_at"], name="intelligence_run_lease")]


class AIAlert(models.Model):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    alert_type = models.CharField(max_length=30)
    fingerprint = models.CharField(max_length=120)
    severity = models.CharField(max_length=10, choices=[(s, s) for s in SEVERITIES])
    title = models.CharField(max_length=180)
    message = models.CharField(max_length=1000)
    status = models.CharField(max_length=15, default="open", choices=[(s, s) for s in STATUSES])
    source = models.CharField(max_length=20, default="RULE_BASED")
    entity_type = models.CharField(max_length=20)
    entity_id = models.PositiveBigIntegerField()
    warehouse = models.ForeignKey("inventory.Warehouse", null=True, on_delete=models.PROTECT)
    # Only service-owned scalar observations; never raw prompts or tool traces.
    metadata = models.JSONField(default=dict)
    condition_active = models.BooleanField(default=True)
    detected_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField()
    acknowledged_at = models.DateTimeField(null=True)
    acknowledged_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT, related_name="acknowledged_ai_alerts")
    resolved_at = models.DateTimeField(null=True)
    resolved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT, related_name="resolved_ai_alerts")
    dismissed_at = models.DateTimeField(null=True)
    dismissed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT, related_name="dismissed_ai_alerts")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-detected_at", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["company", "fingerprint"], condition=models.Q(condition_active=True), name="intelligence_active_episode"),
            models.CheckConstraint(condition=models.Q(status__in=STATUSES), name="intelligence_alert_status"),
            models.CheckConstraint(condition=models.Q(severity__in=SEVERITIES), name="intelligence_alert_severity"),
        ]
        indexes = [models.Index(fields=["company", "status"], name="intelligence_alert_status_idx"), models.Index(fields=["company", "severity"], name="intelligence_alert_severity"), models.Index(fields=["company", "detected_at"], name="intelligence_alert_detected")]
