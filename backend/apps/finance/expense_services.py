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
from .models import Expense


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
    expense.status = {"submit": "submitted", "approve": "approved", "reject": "rejected"}[action]
    prefix = {"submit": "submitted", "approve": "approved", "reject": "rejected"}[action]
    setattr(expense, f"{prefix}_at", timezone.now())
    setattr(expense, f"{prefix}_by_id", membership.user_id)
    if action == "reject":
        expense.rejection_reason = reason
    expense.save()
    return expense


def approve_expense(**kwargs):
    return transition_expense(**kwargs, action="approve")


def reject_expense(**kwargs):
    return transition_expense(**kwargs, action="reject")
