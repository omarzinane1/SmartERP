"""Claim → extract/embed outside transactions → fenced atomic replacement."""
from datetime import timedelta
from uuid import uuid4
from time import monotonic
from django.db import transaction
from django.utils import timezone
from apps.companies.models import Company
from apps.intelligence import policy
from apps.intelligence.embeddings import EmbeddingProvider
from apps.intelligence.llm import AIError
from apps.intelligence.selectors import context
from common.dispatch import enqueue_after_commit
from rest_framework.exceptions import PermissionDenied
from ..models import Document, DocumentChunk
from ..selectors import document_by_id
from ..parsers import extract_pages
from ..chunking import chunk_pages


def authorized(document):
    member, codes = context(document.company, document.rag_requested_by)
    if not {"documents.view", "documents.upload", "documents.ai_analyze"}.issubset(codes):
        raise PermissionDenied()
    document_by_id(document.company, member, codes, document.pk)


def fail_index(document_id, code, token=None):
    query = Document.objects.filter(pk=document_id, rag_status__in=["pending", "processing"])
    if token is not None:
        query = query.filter(rag_claim_token=token)
    query.update(rag_status="failed", rag_error=code, rag_claim_token=None, rag_lease_until=None)


@transaction.atomic
def request_index(*, company, membership, document_id):
    Company.objects.select_for_update().get(pk=company.pk)
    member, codes = context(company, membership)
    if not {"documents.view", "documents.upload", "documents.ai_analyze"}.issubset(codes):
        raise PermissionDenied()
    document_by_id(company, member, codes, document_id)
    obj = Document.objects.select_for_update().get(company=company, pk=document_id)
    if obj.rag_status in {"pending", "processing"} and obj.rag_lease_until and obj.rag_lease_until > timezone.now():
        return obj
    obj.rag_status, obj.rag_error, obj.rag_requested_by = "pending", "", member
    obj.rag_claim_token = None
    obj.rag_lease_until = timezone.now()+timedelta(seconds=policy.INDEX_SECONDS+60)
    obj.save(update_fields=["rag_status", "rag_error", "rag_requested_by", "rag_claim_token", "rag_lease_until", "updated_at"])
    from ..tasks import index_document
    enqueue_after_commit(index_document, obj.pk, failed=lambda: fail_index(obj.pk, "broker_unavailable"))
    return obj


def ingest(document_id):
    token = uuid4()
    deadline = monotonic()+policy.INDEX_SECONDS
    try:
        with transaction.atomic():
            obj = Document.objects.select_for_update().filter(pk=document_id, deleted_at__isnull=True).first()
            if obj is None or obj.rag_status != "pending":
                return
            try:
                authorized(obj)
            except Exception:
                fail_index(obj.pk, "permission_denied")
                return
            obj.rag_status, obj.rag_claim_token = "processing", token
            obj.rag_lease_until = timezone.now()+timedelta(seconds=policy.INDEX_SECONDS)
            obj.save(update_fields=["rag_status", "rag_claim_token", "rag_lease_until"])
        chunks = chunk_pages(extract_pages(obj))
        provider = EmbeddingProvider(deadline=deadline)
        model, digest = provider.identity()
        embeddings = provider.embed_texts([c["content"] for c in chunks])
        if provider.identity() != (model, digest):
            raise AIError("embedding_model_changed")
        with transaction.atomic():
            Company.objects.select_for_update().get(pk=obj.company_id)
            current = Document.objects.select_for_update().get(pk=obj.pk)
            if current.deleted_at or current.rag_claim_token != token or current.rag_lease_until < timezone.now():
                return
            authorized(current)
            current.chunks.all().delete()
            DocumentChunk.objects.bulk_create([DocumentChunk(company_id=obj.company_id, document=current, **chunk,
                embedding=vector, embedding_model=model, embedding_digest=digest, chunk_version=policy.CHUNK_VERSION) for chunk, vector in zip(chunks, embeddings, strict=True)], batch_size=50)
            current.rag_status, current.rag_error = "indexed", ""
            current.embedding_model, current.embedding_digest = model, digest
            current.rag_indexed_at, current.rag_claim_token, current.rag_lease_until = timezone.now(), None, None
            current.save(update_fields=["rag_status", "rag_error", "embedding_model", "embedding_digest", "rag_indexed_at", "rag_claim_token", "rag_lease_until"])
    except Exception as error:
        code = error.code if isinstance(error, AIError) else "permission_denied" if isinstance(error, PermissionDenied) else "indexing_failed"
        # Never persist exception text: it can contain document content or provider addresses.
        fail_index(document_id, code, token)
