import logging
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound
from apps.accounts.services import require_actor
from apps.accounts.selectors import get_effective_permission_codes
from apps.companies.models import Company
from common.exceptions import BusinessConflict
from .models import Document, DocumentLink
from .selectors import document_by_id
from .registry import linked_entity
from .validators import validate_upload

logger = logging.getLogger(__name__)


def _locked_document(company, membership, pk, include_deleted=False):
    codes = get_effective_permission_codes(membership=membership)
    document_by_id(company, membership, codes, pk, include_deleted)
    return Document.objects.select_for_update().get(company=company, pk=pk)


def upload_document(*, company, membership, data):
    """Clean up storage if the metadata transaction fails, including a late link failure."""
    require_actor(company=company, actor=membership, permission_code="documents.upload")
    values = dict(data)
    upload = values.pop("file")
    metadata = validate_upload(upload)
    kind, pk = values.pop("entity_type", None), values.pop("entity_id", None)
    visibility = "private" if values.pop("visibility") == "Privé" else "company"
    obj = Document(company=company, uploaded_by_id=membership.user_id, visibility=visibility, **values, **metadata)
    try:
        with transaction.atomic():
            Company.objects.select_for_update().get(pk=company.pk)
            require_actor(company=company, actor=membership, permission_code="documents.upload")
            if kind:
                linked_entity(company, get_effective_permission_codes(membership=membership), kind, pk, lock=True)
            obj.file.save(obj.original_filename, upload, save=False)
            obj.save()
            if kind:
                DocumentLink.objects.create(company=company, document=obj, entity_type=kind, entity_id=pk, created_by_id=membership.user_id)
            from apps.intelligence.policy import enabled
            if enabled() and {"ai.use", "documents.view", "documents.upload", "documents.ai_analyze"}.issubset(get_effective_permission_codes(membership=membership)):
                from .rag.indexer import request_index
                request_index(company=company, membership=membership, document_id=obj.pk)
                obj.refresh_from_db()
    except Exception:
        if obj.file.name:
            obj.file.storage.delete(obj.file.name)
        raise
    return obj


@transaction.atomic
def link_document(*, company, membership, document_id, data):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="documents.upload")
    obj = _locked_document(company, membership, document_id, include_deleted=True)
    if obj.deleted_at:
        raise BusinessConflict("Document déjà supprimé.")
    linked_entity(company, get_effective_permission_codes(membership=membership), data["entity_type"], data["entity_id"], lock=True)
    link, _ = DocumentLink.objects.get_or_create(company=company, document=obj, **data, defaults=dict(created_by_id=membership.user_id))
    return link


@transaction.atomic
def unlink_document(*, company, membership, document_id, link_id):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="documents.upload")
    obj = _locked_document(company, membership, document_id)
    link = obj.links.filter(company=company, pk=link_id).first()
    if link is None:
        raise NotFound()
    link.delete()


def cleanup_document_file(document_id):
    obj = Document.objects.filter(pk=document_id, deleted_at__isnull=False, file_deleted_at__isnull=True).first()
    if obj is None:
        return
    try:
        obj.file.storage.delete(obj.file.name)
    except Exception:
        logger.exception("Document storage cleanup failed for document %s; retry cleanup_document_files.", obj.pk)
        return
    Document.objects.filter(pk=obj.pk, file_deleted_at__isnull=True).update(file_deleted_at=timezone.now())


@transaction.atomic
def delete_document(*, company, membership, document_id):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="documents.delete")
    obj = _locked_document(company, membership, document_id, include_deleted=True)
    if obj.deleted_at:
        raise BusinessConflict("Document déjà supprimé.")
    obj.deleted_at, obj.deleted_by_id = timezone.now(), membership.user_id
    obj.save(update_fields=["deleted_at", "deleted_by", "updated_at"])
    obj.links.all().delete()
    obj.chunks.all().delete()
    Document.objects.filter(pk=obj.pk).update(rag_claim_token=None, rag_status="not_indexed", rag_lease_until=None)
    transaction.on_commit(lambda: cleanup_document_file(obj.pk))
