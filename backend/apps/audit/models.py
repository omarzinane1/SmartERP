from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=80)
    entity_type = models.CharField(max_length=50)
    entity_id = models.PositiveBigIntegerField(null=True)
    entity_repr = models.CharField(max_length=180, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True)
    user_agent = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict)
    before_data = models.JSONField(default=dict)
    after_data = models.JSONField(default=dict)

    class Meta:
        ordering = ["-timestamp", "-pk"]
        indexes = [models.Index(fields=["company", "timestamp"], name="audit_company_time"), models.Index(fields=["company", "entity_type", "entity_id"], name="audit_company_entity")]


class IdempotencyKey(models.Model):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    key = models.CharField(max_length=128)
    operation = models.CharField(max_length=100)
    request_hash = models.CharField(max_length=64)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    required_permissions = models.JSONField(default=list)
    response_code = models.PositiveSmallIntegerField()
    response_body = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True, null=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["company", "operation", "key"], name="idempotency_company_operation_key")]
