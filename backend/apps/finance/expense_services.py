from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from apps.accounts.services import require_actor
from apps.companies.models import Company
from apps.companies.sequences import next_document_number
from apps.purchasing.models import Supplier
from apps.inventory.services import scoped
from common.exceptions import BusinessConflict
from common.idempotency import request_identity, replay
from .models import Expense, ExpenseCategory


@transaction.atomic
def save_expense_category(*, company, membership, data, category_id=None):
    from django.db.models import Q
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="expenses.create")
    obj = scoped(ExpenseCategory, company, category_id, True) if category_id else ExpenseCategory(company=company)
    for field, value in data.items():
        setattr(obj, field, value)
    if not obj.code:
        obj.code = obj.name
    if ExpenseCategory.objects.filter(company=company).filter(Q(code=obj.code) | Q(name=obj.name)).exclude(pk=obj.pk).exists():
        raise BusinessConflict("Ce nom ou code de catégorie existe déjà.")
    obj.save()
    return obj


@transaction.atomic
def create_expense(*, company, membership, data, key=None, expense_id=None):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="expenses.create")
    if expense_id:
        expense = scoped(Expense, company, expense_id, True)
        if expense.status != "draft":
            raise BusinessConflict("Seule une dépense brouillon est modifiable.")
    else:
        key, fingerprint = request_identity(key, data)
        previous = replay(Expense.objects.filter(company=company), key, fingerprint)
        if previous:
            return previous
        expense = Expense(company=company, created_by_id=membership.user_id, currency=company.currency, operation_key=key, request_fingerprint=fingerprint)
    values = dict(data)
    if "category" in values:
        category = ExpenseCategory.objects.filter(company=company, name=values["category"]).first()
        if category is None:
            category = save_expense_category(company=company, membership=membership, data=dict(name=values["category"]))
        if not category.is_active:
            raise ValidationError("Catégorie inactive.")
        expense.category_record = category
    if "supplier_id" in values:
        pk = values.pop("supplier_id")
        expense.supplier = scoped(Supplier, company, pk) if pk else None
        if expense.supplier and expense.supplier.status != "active":
            raise ValidationError("Fournisseur non actif.")
    for field, value in values.items():
        setattr(expense, field, value)
    if expense.date > timezone.localdate():
        raise ValidationError("Une dépense effective ne peut être future.")
    if expense.currency != "MAD":
        raise ValidationError("Seule la devise MAD est prise en charge.")
    expense.tax_amount = (expense.amount_ht * expense.tax_rate / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    expense.total = expense.amount_ht + expense.tax_amount
    if not expense_id:
        expense.number = next_document_number(company=company, kind="expense", prefix="EXP")
    expense.save()
    return expense


@transaction.atomic
def transition_expense(*, company, membership, expense_id, action, reason=""):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="expenses.create" if action == "submit" else "expenses.approve")
    expense = scoped(Expense, company, expense_id, True)
    if expense.supplier_id and expense.supplier.company_id != company.pk:
        from rest_framework.exceptions import NotFound
        raise NotFound()
    source = {"submit": "draft", "approve": "submitted", "reject": "submitted"}
    if action not in source or expense.status != source[action]:
        raise BusinessConflict("Action de dépense invalide ou déjà effectuée.")
    if action == "reject" and not reason.strip():
        raise ValidationError("Motif de refus obligatoire.")
    if action in {"approve", "reject"}:
        from apps.approvals.services import decide_for_expense
        return decide_for_expense(company=company, membership=membership, expense=expense, action=action, comment=reason)
    expense.status = {"submit": "submitted", "approve": "approved", "reject": "rejected"}[action]
    prefix = {"submit": "submitted", "approve": "approved", "reject": "rejected"}[action]
    setattr(expense, f"{prefix}_at", timezone.now())
    setattr(expense, f"{prefix}_by_id", membership.user_id)
    if action == "reject":
        expense.rejection_reason = reason
    expense.save()
    from apps.approvals.services import request_expense_approval
    request_expense_approval(company=company, membership=membership, expense=expense)
    return expense


def apply_expense_decision(*, expense, membership, action, comment):
    """Internal mutation called only by the locked ApprovalRequest orchestrator."""
    if expense.status != "submitted":
        raise BusinessConflict("Cette dépense n'attend plus de décision.")
    prefix = "approved" if action == "approve" else "rejected"
    expense.status = prefix
    setattr(expense, f"{prefix}_at", timezone.now())
    setattr(expense, f"{prefix}_by_id", membership.user_id)
    if action == "reject":
        expense.rejection_reason = comment
    expense.save()
    return expense


def submit_expense(**kwargs):
    return transition_expense(**kwargs, action="submit")


def approve_expense(**kwargs):
    return transition_expense(**kwargs, action="approve")


def reject_expense(**kwargs):
    return transition_expense(**kwargs, action="reject")


@transaction.atomic
def cancel_expense(*, company, membership, expense_id):
    """Withdraw a pending submission; approved/rejected expenses stay immutable."""
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="expenses.create")
    expense = scoped(Expense, company, expense_id, True)
    request = expense.approval_requests.filter(company=company, status="pending").first()
    if request is None:
        raise BusinessConflict("Aucune soumission à retirer.")
    from apps.approvals.services import cancel_approval_request
    cancel_approval_request(company=company, membership=membership, request_id=request.pk, data=dict(comment="Soumission retirée.", version=request.version))
    expense.refresh_from_db()
    return expense
