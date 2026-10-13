from django.conf import settings
from django.db import models
from .constants import STATUSES, SEVERITIES


class IntelligenceRun(models.Model):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    status = models.CharField(max_length=12, default="pending", choices=[(s, s) for s in ["pending", "running", "completed", "failed"]])
    rules = models.JSONField(default=list)
    summary = models.JSONField(default=dict)
    horizon = models.PositiveSmallIntegerField(default=7)
    granularity = models.CharField(max_length=10, default="day")
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
            models.CheckConstraint(condition=models.Q(horizon__in=[7, 30], granularity="day"), name="intelligence_run_horizon"),
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
    method = models.CharField(max_length=40, default="business_rule")
    metric_name = models.CharField(max_length=40, blank=True)
    analysis_version = models.CharField(max_length=40, blank=True)
    period_date = models.DateField(null=True)
    observed_value = models.DecimalField(max_digits=30, decimal_places=6, null=True)
    expected_value = models.DecimalField(max_digits=30, decimal_places=6, null=True)
    deviation = models.DecimalField(max_digits=30, decimal_places=6, null=True)
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
            models.UniqueConstraint(fields=["company", "fingerprint"], condition=models.Q(source="statistical"), name="intelligence_statistical_dedupe"),
            models.UniqueConstraint(fields=["company", "fingerprint"], condition=models.Q(condition_active=True), name="intelligence_active_episode"),
            models.CheckConstraint(condition=models.Q(status__in=STATUSES), name="intelligence_alert_status"),
            models.CheckConstraint(condition=models.Q(severity__in=SEVERITIES), name="intelligence_alert_severity"),
        ]
        indexes = [models.Index(fields=["company", "status"], name="intelligence_alert_status_idx"), models.Index(fields=["company", "severity"], name="intelligence_alert_severity"), models.Index(fields=["company", "detected_at"], name="intelligence_alert_detected")]


class ForecastRun(models.Model):
    """One bounded, reproducible result per metric and orchestration run."""
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    intelligence_run = models.ForeignKey(IntelligenceRun, on_delete=models.PROTECT, related_name="forecasts")
    metric = models.CharField(max_length=30)
    status = models.CharField(max_length=20)
    model_name = models.CharField(max_length=40, blank=True)
    version = models.CharField(max_length=40)
    granularity = models.CharField(max_length=10, default="day")
    horizon = models.PositiveSmallIntegerField()
    training_start = models.DateField(null=True)
    training_end = models.DateField(null=True)
    mae = models.DecimalField(max_digits=30, decimal_places=6, null=True)
    rmse = models.DecimalField(max_digits=30, decimal_places=6, null=True)
    # Up to 180 history + 30 forecast points; monetary values are strings.
    result = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["intelligence_run", "metric"], name="intelligence_forecast_run_metric"),
            models.CheckConstraint(condition=models.Q(metric__in=["revenue", "net_cash_flow"]), name="intelligence_forecast_metric"),
            models.CheckConstraint(condition=models.Q(horizon__in=[7, 30], granularity="day"), name="intelligence_forecast_horizon"),
            models.CheckConstraint(condition=models.Q(status__in=["completed", "INSUFFICIENT_DATA"]), name="intelligence_forecast_status"),
        ]
        indexes = [models.Index(fields=["company", "metric", "created_at"], name="intelligence_forecast_company")]


class AIOpportunity(models.Model):
    from .opportunity_config import STATUSES as OP_STATUSES, PRIORITIES
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    opportunity_type = models.CharField(max_length=32)
    domain = models.CharField(max_length=16)
    fingerprint = models.CharField(max_length=140)
    title = models.CharField(max_length=180)
    description = models.CharField(max_length=1000)
    reason = models.CharField(max_length=1000)
    priority = models.CharField(max_length=10, choices=[(s, s) for s in PRIORITIES])
    status = models.CharField(max_length=16, default="open", choices=[(s, s) for s in OP_STATUSES])
    entity_type = models.CharField(max_length=16)
    entity_id = models.PositiveBigIntegerField()
    warehouse = models.ForeignKey("inventory.Warehouse", null=True, on_delete=models.PROTECT)
    estimated_value = models.DecimalField(max_digits=30, decimal_places=6, null=True)
    currency = models.CharField(max_length=3)
    confidence = models.DecimalField(max_digits=5, decimal_places=2, null=True)
    source = models.CharField(max_length=16)
    detector = models.CharField(max_length=40)
    version = models.CharField(max_length=40)
    metadata = models.JSONField(default=dict)
    condition_active = models.BooleanField(default=True)
    detected_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField()
    expires_at = models.DateTimeField()
    acknowledged_at = models.DateTimeField(null=True)
    acknowledged_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT, related_name="acknowledged_opportunities")
    dismissed_at = models.DateTimeField(null=True)
    dismissed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT, related_name="dismissed_opportunities")
    completed_at = models.DateTimeField(null=True)
    completed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT, related_name="completed_opportunities")
    expired_at = models.DateTimeField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-detected_at", "-pk"]
        constraints = [
            models.UniqueConstraint(fields=["company", "fingerprint"], condition=models.Q(condition_active=True), name="opportunity_active_condition"),
            models.CheckConstraint(condition=models.Q(status__in=["open", "acknowledged", "completed", "dismissed", "expired"]), name="opportunity_status_valid"),
            models.CheckConstraint(condition=models.Q(priority__in=["low", "medium", "high", "critical"]), name="opportunity_priority_valid"),
            models.CheckConstraint(condition=models.Q(estimated_value__isnull=True) | models.Q(estimated_value__gte=0), name="opportunity_value_nonnegative"),
        ]
        indexes = [models.Index(fields=["company", "status", "priority"], name="opportunity_company_status"),
            models.Index(fields=["company", "opportunity_type", "detected_at"], name="opportunity_company_type"),
            models.Index(fields=["company", "expires_at"], name="opportunity_company_expiry")]
