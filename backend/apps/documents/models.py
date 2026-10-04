from django.conf import settings
from django.db import models
from common.models import TimeStampedModel
from .storage import document_path


class Document(TimeStampedModel):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    name = models.CharField(max_length=180)
    original_filename = models.CharField(max_length=180)
    file = models.FileField(upload_to=document_path, max_length=250)
    mime_type = models.CharField(max_length=80)
    size = models.PositiveIntegerField()
    page_count = models.PositiveSmallIntegerField(default=1)
    category = models.CharField(max_length=80, blank=True)
    department = models.CharField(max_length=80, blank=True)
    visibility = models.CharField(max_length=20, choices=[("company", "Public entreprise"), ("private", "Privé")], default="company")
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="uploaded_documents")
    deleted_at = models.DateTimeField(null=True)
    deleted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, related_name="deleted_documents")
    file_deleted_at = models.DateTimeField(null=True)

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [
            models.CheckConstraint(condition=models.Q(size__gt=0, size__lte=15728640), name="document_size_valid"),
            models.CheckConstraint(condition=models.Q(visibility__in=["company", "private"]), name="document_visibility_valid"),
        ]
        indexes = [models.Index(fields=["company", "deleted_at", "created_at"], name="document_company_deleted_date")]


class DocumentLink(models.Model):
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)
    document = models.ForeignKey(Document, on_delete=models.PROTECT, related_name="links")
    entity_type = models.CharField(max_length=30)
    entity_id = models.PositiveBigIntegerField()
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["document", "entity_type", "entity_id"], name="unique_document_entity_link"),
            models.CheckConstraint(condition=models.Q(entity_id__gt=0, entity_type__in=["customer", "supplier", "quote", "sales_order", "invoice", "payment", "purchase_order", "supplier_invoice", "product", "expense"]), name="document_link_target_valid")]
        indexes = [models.Index(fields=["company", "entity_type", "entity_id"], name="document_link_company_target")]
