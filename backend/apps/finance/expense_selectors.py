from django.db.models import Q
from rest_framework.exceptions import NotFound
from .models import Expense

CATEGORIES = ["Déplacements", "Fournitures", "Télécommunications", "Maintenance", "Loyer", "Marketing"]


def expense_queryset(company):
    return Expense.objects.filter(company=company).filter(Q(supplier__isnull=True) | Q(supplier__company=company)).select_related("supplier")


def expense_by_id(company, pk):
    obj = expense_queryset(company).filter(pk=pk).first()
    if obj is None:
        raise NotFound()
    return obj


def expense_payload(expense, permissions):
    return dict(id=expense.pk, reference=expense.number, date=expense.date.isoformat(), description=expense.description,
        category=expense.category, supplierId=expense.supplier_id, supplierName=expense.supplier.name if expense.supplier_id else None,
        employee=expense.employee, amountHT=expense.amount_ht, taxRate=expense.tax_rate, taxAmount=expense.tax_amount, total=expense.total,
        currency=expense.currency, status=expense.status, note=expense.note, paidDate=expense.paid_date.isoformat() if expense.paid_date else None,
        receipt=None, submittedAt=expense.submitted_at, approvedAt=expense.approved_at, rejectedAt=expense.rejected_at, rejectionReason=expense.rejection_reason,
        capabilities=dict(canSubmit=expense.status == "draft" and "expenses.create" in permissions,
            canApprove=expense.status == "submitted" and "expenses.approve" in permissions,
            canReject=expense.status == "submitted" and "expenses.approve" in permissions))
