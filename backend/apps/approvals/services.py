from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError, PermissionDenied
from apps.accounts.services import require_actor
from apps.accounts.selectors import get_effective_permission_codes
from apps.companies.models import Company
from apps.companies.sequences import next_document_number
from apps.finance.models import Expense
from apps.purchasing.models import PurchaseOrder
from common.exceptions import BusinessConflict
from .models import ApprovalRequest


def locked_request(company, pk):
    obj = ApprovalRequest.objects.select_for_update().filter(company=company, pk=pk).first()
    if obj is None:
        raise NotFound()
    model, pk = (Expense, obj.expense_id) if obj.expense_id else (PurchaseOrder, obj.purchase_order_id)
    entity = model.objects.select_for_update().filter(company=company, pk=pk).first()
    if entity is None:
        raise NotFound()
    return obj, entity


def _new_request(company, membership, entity, workflow):
    field = "expense" if workflow == "expense" else "purchase_order"
    if ApprovalRequest.objects.filter(company=company, status="pending", **{field: entity}).exists():
        raise BusinessConflict("Une demande est déjà en attente pour cet enregistrement.")
    return ApprovalRequest.objects.create(company=company, **{field: entity}, workflow_type=workflow,
        number=next_document_number(company=company, kind="approval", prefix="APR"), requested_by_id=membership.user_id,
        requested_at=timezone.now(), source_updated_at=entity.updated_at)


@transaction.atomic
def request_expense_approval(*, company, membership, expense):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="expenses.create")
    expense = Expense.objects.select_for_update().filter(company=company, pk=expense.pk).first()
    if expense is None:
        raise NotFound()
    if expense.status != "submitted":
        raise BusinessConflict("Une dépense soumise est requise.")
    return _new_request(company, membership, expense, "expense")


@transaction.atomic
def request_approval(*, company, membership, order_id):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="purchases.edit")
    from apps.purchasing.services import locked_order
    order = locked_order(company, order_id)
    if order.status == "cancelled":
        raise BusinessConflict("Une commande annulée ne peut être soumise à revue.")
    return _new_request(company, membership, order, "purchase_review")


def _decide(*, company, membership, request, entity, action, comment, version):
    if request.status != "pending" or request.version != version:
        raise BusinessConflict("Demande déjà décidée ou version obsolète.")
    if action not in {"approve", "reject"}:
        raise ValidationError("Décision inconnue.")
    if action == "reject" and not comment.strip():
        raise ValidationError("Motif de refus obligatoire.")
    if entity.updated_at != request.source_updated_at:
        raise BusinessConflict("L'enregistrement a changé depuis la demande. Retirez-la puis soumettez une nouvelle demande.")
    if request.expense_id:
        require_actor(company=company, actor=membership, permission_code="expenses.approve")
        from apps.finance.expense_services import apply_expense_decision
        apply_expense_decision(expense=entity, membership=membership, action=action, comment=comment)
    else:
        require_actor(company=company, actor=membership, permission_code="purchases.confirm")
        if entity.status == "cancelled":
            raise BusinessConflict("Commande annulée.")
        from apps.purchasing.services import activity
        activity(entity, membership, "Revue approuvée" if action == "approve" else "Revue refusée", comment[:255] or "Décision de revue ; confirmation de commande indépendante.")
    request.status = "approved" if action == "approve" else "rejected"
    request.decided_by_id, request.decided_at, request.comment = membership.user_id, timezone.now(), comment
    request.version += 1
    request.save()
    from apps.notifications.services import notify_approval_decision
    notify_approval_decision(company=company, approval=request)
    return request


@transaction.atomic
def decide_request(*, company, membership, request_id, action, data):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="approvals.approve")
    request, entity = locked_request(company, request_id)
    return _decide(company=company, membership=membership, request=request, entity=entity, action=action, **data)


@transaction.atomic
def decide_for_expense(*, company, membership, expense, action, comment):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="expenses.approve")
    request = ApprovalRequest.objects.select_for_update().filter(company=company, expense=expense, status="pending").first()
    if request is None:
        raise BusinessConflict("Aucune demande de décision en attente.")
    _decide(company=company, membership=membership, request=request, entity=expense, action=action, comment=comment, version=request.version)
    return expense


@transaction.atomic
def cancel_approval_request(*, company, membership, request_id, data):
    Company.objects.select_for_update().get(pk=company.pk)
    request, entity = locked_request(company, request_id)
    require_actor(company=company, actor=membership, permission_code="expenses.create" if request.expense_id else "purchases.edit")
    codes = get_effective_permission_codes(membership=membership)
    if request.requested_by_id != membership.user_id and "approvals.approve" not in codes:
        raise PermissionDenied()
    if request.status != "pending" or request.version != data["version"]:
        raise BusinessConflict("Demande déjà décidée ou version obsolète.")
    if request.expense_id:
        if entity.status != "submitted":
            raise BusinessConflict("Cette dépense ne peut plus être retirée.")
        entity.status, entity.submitted_at, entity.submitted_by = "draft", None, None
        entity.save()
    request.status, request.comment = "cancelled", data["comment"]
    request.decided_by_id, request.decided_at = membership.user_id, timezone.now()
    request.version += 1
    request.save()
    return request


def approve_request(**kwargs):
    return decide_request(**kwargs, action="approve")


def reject_request(**kwargs):
    return decide_request(**kwargs, action="reject")
