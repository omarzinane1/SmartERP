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
