"""Personal conversations; bounded history and publication-time authorization."""
from datetime import timedelta
import json
from time import monotonic
from uuid import uuid4
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, Throttled
from apps.companies.models import Company
from apps.documents.rag.retriever import accessible_chunks
from common.exceptions import BusinessConflict
from . import policy
from .guardrails import inspect_input, deadline_check
from .llm import AIError
from .models import AIConversation, AIMessage
from .orchestrator import run_graph
from .tools.registry import AIToolContext, audit


def make_context(company, membership):
    return AIToolContext(company.pk, membership.pk, membership.user_id, str(uuid4()), monotonic()+policy.CHAT_SECONDS)


def conversations(ctx):
    ctx.actor()
    return AIConversation.objects.filter(company_id=ctx.company_id, user_id=ctx.user_id)


@transaction.atomic
def create_conversation(ctx):
    Company.objects.select_for_update().get(pk=ctx.company_id)
    ctx.actor()
    if conversations(ctx).filter(created_at__gte=timezone.now()-timedelta(minutes=1)).count() >= policy.RATE_PER_MINUTE:
        raise Throttled(60)
    obj = AIConversation.objects.create(company_id=ctx.company_id, user_id=ctx.user_id)
    audit(ctx, "conversation_started", conversation_id=obj.pk)
    return obj


def require_evidence(ctx, required, ids):
    ctx.actor(required)
    if ids and set(accessible_chunks(ctx).filter(pk__in=ids).values_list("pk", flat=True)) != set(ids):
        raise PermissionDenied()


def message_payload(ctx, obj):
    if obj.conversation.company_id != ctx.company_id or obj.conversation.user_id != ctx.user_id:
        raise NotFound()
    ctx.actor()
    result = dict(id=str(obj.pk), role=obj.role, text=obj.content, blocks=[], sources=[], tools=[], period=None,
        simulated=False, createdAt=obj.created_at.isoformat())
    result.update(obj.payload)
    try:
        require_evidence(ctx, obj.required_permissions, obj.chunk_ids)
    except PermissionDenied:
        result.update(text="Cette réponse n'est plus accessible avec vos droits actuels.", blocks=[], sources=[], tools=[], status="redacted")
    return result


def conversation_payload(ctx, obj):
    rows = list(obj.messages.order_by("-created_at", "-pk")[:policy.MAX_HISTORY])
    return dict(id=str(obj.pk), title=obj.title, createdAt=obj.created_at.isoformat(), messages=[message_payload(ctx, m) for m in reversed(rows)])


def chat(ctx, conversation_id, question, request_id=None, *, forced_document=None):
    request_id = request_id or uuid4()
    guard = inspect_input(question)
    token = uuid4()
    with transaction.atomic():
        Company.objects.select_for_update().get(pk=ctx.company_id)
        obj = conversations(ctx).select_for_update().filter(pk=conversation_id).first()
        if obj is None:
            raise NotFound()
        existing = obj.messages.filter(role="assistant", request_id=request_id).first()
        original = obj.messages.filter(role="user", request_id=request_id).first()
        if original and original.content != question:
            raise BusinessConflict("Identifiant déjà utilisé pour une autre question.")
        if existing:
            return message_payload(ctx, existing)
        if obj.lease_until and obj.lease_until > timezone.now():
            raise BusinessConflict("Une réponse est déjà en cours dans cette conversation.")
        if AIMessage.objects.filter(conversation__company_id=ctx.company_id, conversation__user_id=ctx.user_id,
            role="user", created_at__gte=timezone.now()-timedelta(minutes=1)).count() >= policy.RATE_PER_MINUTE:
            raise Throttled(60)
        obj.claim_token, obj.lease_until = token, timezone.now()+timedelta(seconds=policy.CHAT_SECONDS+10)
        if not obj.messages.exists():
            obj.title = question[:100]
        obj.save(update_fields=["claim_token", "lease_until", "title", "updated_at"])
        user_message, _ = obj.messages.get_or_create(role="user", request_id=request_id, defaults=dict(content=question))
    try:
        history, prior_codes, prior_chunks = [], set(), set()
        # Read bounded messages; rights are rechecked before sending any previous evidence to Ollama.
        for m in reversed(list(obj.messages.exclude(pk=user_message.pk).order_by("-pk")[:policy.MAX_HISTORY])):
            if m.role == "user" and inspect_input(m.content) != "allowed":
                continue
            payload = message_payload(ctx, m)
            if payload.get("status") == "redacted":
                continue
            text = payload["text"] or json.dumps(payload.get("blocks", []), ensure_ascii=False)
            history.append(dict(role=m.role, content=text[:1200]))
            prior_codes.update(m.required_permissions)
            prior_chunks.update(m.chunk_ids)
        # History has its own small budget, leaving room for source chunks and tool schemas.
        while len(json.dumps(history, ensure_ascii=False).encode()) > 6000:
            history.pop(0)
        if len(prior_chunks) > 64-policy.MAX_RAG_CHUNKS:
            # Bound transitive provenance as well as prompt text; never retain text
            # after dropping the permission/document dependencies that protect it.
            history, prior_codes, prior_chunks = [], set(), set()
        if guard != "allowed":
            audit(ctx, "guardrail_blocked" if guard == "blocked" else "confirmation_required", conversation_id=obj.pk, status=guard)
            result = dict(text="Cette demande dépasse les accès autorisés de l'assistant." if guard == "blocked" else
                "Cette opération nécessite une décision humaine dans le module métier concerné. L'assistant ne peut pas l'exécuter.",
                blocks=[], sources=[], tools=[], required_permissions=[], chunk_ids=[], status=guard)
        else:
            result = run_graph(ctx, question, history, forced_document=forced_document)
            deadline_check(ctx.deadline)
            result["required_permissions"] = sorted(set(result["required_permissions"]) | prior_codes)
            result["chunk_ids"] = sorted(set(result["chunk_ids"]) | prior_chunks)
        require_evidence(ctx, result["required_permissions"], result["chunk_ids"])
    except Exception as error:
        code = error.code if isinstance(error, AIError) else "permission_denied" if isinstance(error, PermissionDenied) else "assistant_unavailable"
        audit(ctx, "llm_failure", conversation_id=obj.pk, error_code=code, status="failed")
        result = dict(text="Réponse indisponible : accès refusé." if code == "permission_denied" else "Réponse indisponible. Vérifiez le service IA et réessayez.",
            blocks=[], sources=[], tools=[], required_permissions=[], chunk_ids=[], status="failed", errorCode=code)
    with transaction.atomic():
        Company.objects.select_for_update().get(pk=ctx.company_id)
        obj = conversations(ctx).select_for_update().get(pk=obj.pk)
        if obj.claim_token != token or obj.lease_until < timezone.now():
            raise BusinessConflict("La demande a expiré. Réessayez.")
        require_evidence(ctx, result["required_permissions"], result["chunk_ids"])
        required, ids, content = result.pop("required_permissions"), result.pop("chunk_ids"), result.pop("text")
        message = obj.messages.create(role="assistant", request_id=request_id, content=content, payload=result, required_permissions=required, chunk_ids=ids)
        obj.claim_token, obj.lease_until = None, None
        obj.save(update_fields=["claim_token", "lease_until", "updated_at"])
        return message_payload(ctx, message)
