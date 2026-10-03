from django.db.models import Prefetch, Q
from django.utils import timezone
from rest_framework.exceptions import NotFound
from apps.crm.selectors import salesperson_name
from apps.sales.pricing import ZERO
from .models import SupplierInvoice, SupplierInvoiceLine, SupplierInvoiceActivity, GoodsReceipt


def invoice_queryset(company):
    return SupplierInvoice.objects.filter(company=company, supplier__company=company).filter(Q(order__isnull=True) | Q(order__company=company)).select_related("supplier__buyer__user", "order").prefetch_related(
        Prefetch("lines", queryset=SupplierInvoiceLine.objects.filter(company=company).select_related("purchase_line")),
        Prefetch("activities", queryset=SupplierInvoiceActivity.objects.filter(company=company)),
        Prefetch("order__receipts", queryset=GoodsReceipt.objects.filter(company=company)))


def invoice_by_id(company, pk):
    invoice = invoice_queryset(company).filter(pk=pk).first()
    if invoice is None:
        raise NotFound()
    return invoice


def invoice_payload(invoice, permissions, detail=False):
    today = timezone.localdate()
    payments = []
    if detail and "payments.view" in permissions:
        from apps.finance.selectors import payment_queryset, payment_payload
        payments = [payment_payload(p, permissions) for p in payment_queryset(invoice.company).filter(allocations__supplier_invoice=invoice).distinct()]
    return dict(id=invoice.pk, reference=invoice.number, supplierId=invoice.supplier_id, supplierName=invoice.supplier.name,
        supplierReference=invoice.supplier_reference, buyer=salesperson_name(invoice.supplier.buyer),
        invoiceDate=invoice.issue_date.isoformat(), dueDate=invoice.due_date.isoformat(), currency=invoice.currency,
        paymentTerms=invoice.payment_terms, notes=invoice.notes, orderId=invoice.order_id, orderReference=invoice.order.number if invoice.order_id else None,
        receipts=[dict(id=r.pk, reference=r.number) for r in invoice.order.receipts.all()] if invoice.order_id and "purchases.view" in permissions else [],
        total=invoice.total, paidAmount=invoice.amount_paid, balanceDue=invoice.balance_due,
        workflowStatus=invoice.status, paymentStatus="paid" if invoice.balance_due == 0 else "partially_paid" if invoice.amount_paid > 0 else "unpaid",
        overdue=invoice.status == "posted" and invoice.balance_due > 0 and invoice.due_date < today,
        lines=[dict(id=str(l.pk), productId=l.product_id, productName=l.product_name, description=l.description,
            quantity=l.quantity, unitPrice=l.unit_price, discountRate=l.discount_rate, taxRate=l.tax_rate,
            purchaseLineId=str(l.purchase_line_id) if l.purchase_line_id else None,
            orderedQuantity=l.purchase_line.quantity if l.purchase_line_id else None,
            receivedQuantity=l.purchase_line.received_quantity if l.purchase_line_id else None) for l in invoice.lines.all()],
        payments=payments, documents=[], activities=[dict(id=str(a.pk), date=a.created_at.isoformat(), title=a.title, detail=a.detail) for a in invoice.activities.all()],
        permissions=permissions, asOf=today.isoformat(), capabilities=dict(canEdit=invoice.status == "draft" and "supplier_invoices.edit" in permissions,
            canPost=invoice.status == "draft" and "supplier_invoices.edit" in permissions,
            canPay=invoice.status == "posted" and invoice.balance_due > 0 and "payments.create" in permissions))


def payable_aging(company):
    rows = {key: dict(key=key, label=label, amount=ZERO, count=0) for key, label in [("current", "Non échu"), ("1-30", "1–30 jours"), ("31-60", "31–60 jours"), ("61-90", "61–90 jours"), ("90+", "Plus de 90 jours")]}
    for invoice in SupplierInvoice.objects.filter(company=company, supplier__company=company, status="posted", balance_due__gt=0):
        age = (timezone.localdate()-invoice.due_date).days
        key = "current" if age <= 0 else "1-30" if age <= 30 else "31-60" if age <= 60 else "61-90" if age <= 90 else "90+"
        rows[key]["amount"] += invoice.balance_due
        rows[key]["count"] += 1
    return list(rows.values())
