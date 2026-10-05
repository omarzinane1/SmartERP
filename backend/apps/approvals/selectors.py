from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import NotFound
from .models import ApprovalRequest


def approval_queryset(company, permissions):
    query = ApprovalRequest.objects.filter(company=company).filter(Q(expense__company=company) | Q(purchase_order__company=company)).select_related(
        "expense", "purchase_order", "requested_by", "decided_by")
    allowed = Q(pk__in=[])
    if "expenses.view" in permissions:
        allowed |= Q(workflow_type="expense")
    if "purchases.view" in permissions:
        allowed |= Q(workflow_type="purchase_review")
    return query.filter(allowed)


def approval_by_id(company, permissions, pk):
    obj = approval_queryset(company, permissions).filter(pk=pk).first()
    if obj is None:
        raise NotFound()
    return obj


def approval_payload(request, permissions, membership=None, include_documents=False):
    expense = request.expense_id is not None
    entity = request.expense if expense else request.purchase_order
    kind = "expense" if expense else "purchase"
    can = request.status == "pending" and "approvals.approve" in permissions and ("expenses.approve" if expense else "purchases.confirm") in permissions and entity.updated_at == request.source_updated_at
    attachments = []
    if include_documents and membership is not None:
        from apps.documents.selectors import entity_documents
        attachments = [dict(id=obj.pk, name=obj.name, canOpen=True) for obj in entity_documents(membership.company, membership, permissions, "expense" if expense else "purchase_order", entity.pk)]
    can_cancel = request.status == "pending" and membership is not None and ("expenses.create" if expense else "purchases.edit") in permissions and (request.requested_by_id == membership.user_id or "approvals.approve" in permissions)
    return dict(id=request.pk, reference=request.number, date=request.requested_at.isoformat(), type=kind,
        requester=request.requested_by.get_full_name() or request.requested_by.email,
        context=entity.description if expense else f"Revue de la commande {entity.number}", amount=entity.total, risk=None,
        status=request.status, approver=(request.decided_by.get_full_name() or request.decided_by.email) if request.decided_by_id else None,
        recordId=entity.pk, recordPath="/expenses" if expense else f"/purchases/{entity.pk}",
        canOpenRecord=("expenses.view" if expense else "purchases.view") in permissions, attachments=attachments,
        comments=[dict(id=str(request.pk), author=request.decided_by.get_full_name() or request.decided_by.email,
            date=request.decided_at.isoformat(), text=request.comment)] if request.comment and request.decided_by_id and request.decided_at else [],
        aiRecommendation=None, impact="La décision actualise le statut de la dépense. Aucun paiement n'est déclenché." if expense else "Revue de la commande uniquement. Sa confirmation, sa réception et ses paiements restent indépendants.",
        version=request.version, capabilities=dict(canApprove=can, canReject=can, canCancel=can_cancel), asOf=timezone.localdate().isoformat())
