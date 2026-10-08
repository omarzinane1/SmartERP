from django.conf import settings
from django.db import models
from apps.documents.storage import export_path


class GeneratedExport(models.Model):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    entity = models.CharField(max_length=40)
    filters = models.JSONField(default=dict)
    format = models.CharField(max_length=5, choices=[("csv", "CSV"), ("xlsx", "Excel")])
    filename = models.CharField(max_length=150)
    file = models.FileField(upload_to=export_path, max_length=250)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [models.CheckConstraint(condition=models.Q(format__in=["csv", "xlsx"]), name="generated_export_format_valid")]
        indexes = [models.Index(fields=["company", "created_at"], name="export_company_created")]


class AsyncJob(models.Model):
    TYPES = ["report_export", "excel_export", "pdf_generation"]
    STATUSES = ["pending", "processing", "completed", "failed"]
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    job_type = models.CharField(max_length=25, choices=[(s, s) for s in TYPES])
    entity = models.CharField(max_length=40)
    target_id = models.PositiveBigIntegerField(null=True)
    parameters = models.JSONField(default=dict)
    format = models.CharField(max_length=5)
    status = models.CharField(max_length=12, default="pending", choices=[(s, s) for s in STATUSES])
    filename = models.CharField(max_length=150, blank=True)
    result_file = models.FileField(upload_to=export_path, max_length=250, blank=True)
    error_code = models.CharField(max_length=50, blank=True)
    error_message = models.CharField(max_length=250, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True)
    completed_at = models.DateTimeField(null=True)
    lease_expires_at = models.DateTimeField(null=True)
    claim_token = models.UUIDField(null=True)
    attempts = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [
            models.CheckConstraint(condition=models.Q(status__in=["pending", "processing", "completed", "failed"]), name="async_job_status_valid"),
            models.CheckConstraint(condition=(models.Q(job_type="report_export", format="csv", target_id__isnull=True) | models.Q(job_type="excel_export", format="xlsx", target_id__isnull=True) | models.Q(job_type="pdf_generation", format="pdf", entity__in=["invoice", "quote"], target_id__isnull=False)), name="async_job_type_format_valid"),
            models.CheckConstraint(condition=~models.Q(status="completed") | (~models.Q(result_file="") & models.Q(completed_at__isnull=False)), name="async_job_completed_has_file"),
        ]
        indexes = [models.Index(fields=["company", "requested_by", "created_at"], name="job_company_owner_created"), models.Index(fields=["status", "lease_expires_at"], name="job_status_lease")]
