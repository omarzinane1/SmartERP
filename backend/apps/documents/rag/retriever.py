from django.conf import settings
from django.db import transaction, connection
from pgvector.django import CosineDistance
from apps.intelligence import policy
from apps.intelligence.embeddings import EmbeddingProvider
from apps.intelligence.llm import AIError
from apps.intelligence.tools.registry import audit
from ..models import DocumentChunk
from ..selectors import document_queryset


def accessible_chunks(ctx):
    company, member, codes = ctx.actor(("documents.view", "documents.ai_analyze"))
    documents = document_queryset(company, member, codes).order_by().values("pk")
    return DocumentChunk.objects.filter(company=company, document__company=company, document_id__in=documents,
        document__rag_status="indexed", chunk_version=policy.CHUNK_VERSION)


def retrieve(ctx, question, *, document_id=None, top_k=policy.DEFAULT_TOP_K):
    if type(top_k) is not int or not 1 <= top_k <= policy.MAX_RAG_CHUNKS:
        raise AIError("invalid_top_k")
    query = accessible_chunks(ctx)
    if document_id is not None:
        query = query.filter(document_id=document_id)
    provider = EmbeddingProvider(deadline=ctx.deadline)
    model, digest = provider.identity()
    vector = provider.embed_text(question)
    if provider.identity() != (model, digest):
        raise AIError("embedding_model_changed")
    # Tenant, privacy, linked-entity RBAC and model identity are SQL WHERE predicates,
    # applied BEFORE distance ordering/LIMIT. Exact search avoids ANN post-filter underfill.
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute("SELECT set_config('statement_timeout', %s, true)", [str(policy.SQL_TIMEOUT_MS)])
        rows = list(query.filter(embedding_model=model, embedding_digest=digest,
            document__embedding_model=model, document__embedding_digest=digest).annotate(distance=CosineDistance("embedding", vector))
            .filter(distance__lte=settings.RAG_MAX_COSINE_DISTANCE).order_by("distance", "pk").values(
                "id", "document_id", "document__name", "chunk_index", "content", "page_number", "distance")[:top_k])
    seen, unique = set(), []
    for row in rows:
        normalized = " ".join(row["content"].split())
        if normalized not in seen:
            seen.add(normalized)
            unique.append(row)
    audit(ctx, "rag_retrieved", status="completed", chunk_count=len(unique))
    return unique
