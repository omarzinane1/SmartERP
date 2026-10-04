import re
from django.apps import apps
from django.db import transaction
from django.db.models import BigIntegerField, Max
from django.db.models.functions import Cast, Substr
from django.utils import timezone
from .models import Company, DocumentSequence


@transaction.atomic
def next_document_number(*, company, kind, prefix, start=1, dated=True):
    # The Company lock also covers the first sequence row's creation race.
    # Call inside the document transaction so a failed document uses no number.
    Company.objects.select_for_update().get(pk=company.pk)
    year = timezone.localdate().year if dated else 0
    sequence = DocumentSequence.objects.select_for_update().filter(company=company, kind=kind, year=year).first()
    if sequence is None:
        # Preserve pre-existing/imported documents when initializing a sequence.
        # This MAX is used only once, under the Company lock, never count()+1.
        app_label, model_name, field = {
            "customer": ("crm", "Customer", "reference"), "quote": ("sales", "Quote", "number"),
            "sales_order": ("sales", "SalesOrder", "number"), "invoice": ("sales", "Invoice", "number"),
            "credit_note": ("sales", "CreditNote", "number"), "payment": ("finance", "Payment", "number"),
            "supplier": ("purchasing", "Supplier", "reference"), "purchase_order": ("purchasing", "PurchaseOrder", "number"),
            "goods_receipt": ("purchasing", "GoodsReceipt", "number"),
            "supplier_invoice": ("purchasing", "SupplierInvoice", "number"),
            "warehouse": ("inventory", "Warehouse", "code"),
            "stock_movement": ("inventory", "StockMovement", "number"),
            "stock_transfer": ("inventory", "StockTransfer", "number"),
            "expense": ("finance", "Expense", "number"),
            "approval": ("approvals", "ApprovalRequest", "number"),
        }[kind]
        stem = f"{prefix}-{year}-" if dated else f"{prefix}-"
        model = apps.get_model(app_label, model_name)
        existing = model.objects.filter(company=company, **{f"{field}__regex": rf"^{re.escape(stem)}[0-9]{{1,18}}$"})
        last = existing.aggregate(value=Max(Cast(Substr(field, len(stem) + 1), BigIntegerField())))["value"] or 0
        sequence = DocumentSequence.objects.create(company=company, kind=kind, year=year, next_value=max(start, last + 1))
    value = sequence.next_value
    sequence.next_value += 1
    sequence.save(update_fields=["next_value"])
    return f"{prefix}-{year}-{value:04d}" if dated else f"{prefix}-{value:06d}"
