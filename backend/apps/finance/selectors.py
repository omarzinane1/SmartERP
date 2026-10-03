from datetime import timedelta
from decimal import Decimal
from django.db.models import Prefetch, Q
from django.utils import timezone
from rest_framework.exceptions import NotFound
from apps.crm.models import Customer
from apps.purchasing.models import Supplier
from apps.sales.invoice_selectors import invoice_queryset
from apps.sales.pricing import ZERO
from .models import Payment, PaymentAllocation


def payment_queryset(company):
    return Payment.objects.filter(company=company).filter(
        Q(direction="incoming", customer__company=company) | Q(direction="outgoing", supplier__company=company),
    ).select_related("customer", "supplier").prefetch_related(Prefetch("allocations", queryset=
        PaymentAllocation.objects.filter(company=company).filter(Q(invoice__company=company) | Q(supplier_invoice__company=company)).select_related("invoice", "supplier_invoice")))


def payment_by_id(company, payment_id):
    payment = payment_queryset(company).filter(pk=payment_id).first()
    if payment is None:
        raise NotFound()
    return payment


def payment_payload(payment, permissions):
    allocations = list(payment.allocations.all())
    visible = ("invoices.view" if payment.direction == "incoming" else "supplier_invoices.view") in permissions
    documents = [a.invoice if a.invoice_id else a.supplier_invoice for a in allocations]
    invoice_ids = {i.pk for i in documents}
    invoice = documents[0] if len(invoice_ids) == 1 and visible else None
    active = sum((a.amount for a in allocations if a.reversed_at is None), ZERO)
    partner = payment.customer if payment.direction == "incoming" else payment.supplier
    return dict(id=payment.pk, reference=payment.number, direction=payment.direction,
        partnerType="customer" if payment.direction == "incoming" else "supplier", partnerId=partner.pk, partnerName=partner.name,
        invoiceId=invoice.pk if invoice else None, invoiceReference=invoice.number if invoice else None,
        invoiceIssuedDate=invoice.issue_date.isoformat() if invoice else None, date=payment.date.isoformat(),
        amount=payment.amount, currency=payment.currency, method=payment.method, status=payment.status,
        referenceExternal=payment.reference_external, note=payment.note,
        canCancel="payments.cancel" in permissions and payment.status in {"pending", "completed"},
        allocatedAmount=active, availableAmount=payment.amount - active if payment.status == "completed" else ZERO,
        allocations=[dict(id=a.pk, invoiceId=doc.pk, invoiceReference=doc.number, amount=a.amount,
                          reversedAt=a.reversed_at) for a, doc in zip(allocations, documents)] if visible else [])


def filter_payments(query, filters):
    for field in ("direction", "status", "method"):
        if filters.get(field):
            query = query.filter(**{field: filters[field]})
    kind = filters.get("partner_type")
    if kind:
        query = query.filter(**{f"{kind}__isnull": False})
    if filters.get("partner_id"):
        pk = filters["partner_id"]
        query = query.filter(**{f"{kind}_id": pk}) if kind else query.filter(Q(customer_id=pk) | Q(supplier_id=pk))
    if filters.get("search"):
        term = filters["search"]
        query = query.filter(Q(number__icontains=term) | Q(reference_external__icontains=term) | Q(customer__name__icontains=term) | Q(supplier__name__icontains=term))
    if filters.get("invoice"):
        query = query.filter(Q(allocations__invoice__number__icontains=filters["invoice"]) | Q(allocations__supplier_invoice__number__icontains=filters["invoice"]))
    today, period = timezone.localdate(), filters.get("period")
    start = today if period == "today" else today - timedelta(days=today.weekday()) if period == "week" else today.replace(day=1) if period == "month" else None
    if start:
        query = query.filter(date__gte=start, date__lte=today)
    for param, field in [("date_from", "date__gte"), ("date_to", "date__lte"), ("min_amount", "amount__gte"), ("max_amount", "amount__lte")]:
        if param in filters:
            query = query.filter(**{field: filters[param]})
    return query.distinct().order_by({"date_desc": "-date", "date_asc": "date", "amount_desc": "-amount", "reference": "number"}[filters.get("sort", "date_desc")], "pk")


def payment_summary(query):
    received = sent = pending = ZERO
    delays = []
    for payment in query:
        if payment.status == "pending":
            pending += payment.amount
        if payment.status != "completed":
            continue
        if payment.direction == "outgoing":
            sent += payment.amount
        else:
            received += payment.amount
            # One observation per payment; for multiple invoices use an
            # allocation-weighted delay, then a simple mean across payments.
            rows = [a for a in payment.allocations.all() if a.reversed_at is None and payment.date >= a.invoice.issue_date]
            total = sum((a.amount for a in rows), ZERO)
            if total:
                delays.append(sum((Decimal((payment.date - a.invoice.issue_date).days) * a.amount for a in rows), ZERO) / total)
    return dict(received=received, sent=sent, pending=pending, datedReceipts=len(delays),
                averageCollectionDays=(sum(delays, ZERO) / Decimal(len(delays))).quantize(Decimal("0.1")) if delays else None)


def payment_options(company, permissions):
    invoices = invoice_queryset(company).filter(status="posted", balance_due__gt=0) if "payments.create" in permissions and "invoices.view" in permissions else []
    partners = [dict(id=c.pk, name=c.name, type="customer") for c in Customer.objects.filter(company=company).exclude(status="archived")] if "payments.create" in permissions else []
    if "payments.create" in permissions:
        partners += [dict(id=s.pk, name=s.name, type="supplier") for s in Supplier.objects.filter(company=company, status="active")]
    from apps.purchasing.invoice_selectors import invoice_queryset as supplier_invoices
    outgoing = supplier_invoices(company).filter(status="posted", balance_due__gt=0) if "payments.create" in permissions and "supplier_invoices.view" in permissions else []
    return dict(partners=partners, openInvoices=[dict(id=i.pk, reference=i.number, direction="incoming", partnerId=i.customer_id,
        partnerName=i.customer.name, remainingAmount=i.balance_due, issuedDate=i.issue_date.isoformat()) for i in invoices] + [dict(id=i.pk, reference=i.number, direction="outgoing", partnerId=i.supplier_id, partnerName=i.supplier.name, remainingAmount=i.balance_due, issuedDate=i.issue_date.isoformat()) for i in outgoing])
