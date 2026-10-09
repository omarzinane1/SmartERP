from datetime import timedelta
from django.db.models import F, Prefetch, Q
from django.utils import timezone
from rest_framework.exceptions import NotFound
from apps.accounts.selectors import get_effective_permission_codes
from apps.crm.selectors import company_salespeople, salesperson_name
from .models import CreditNote, Invoice, InvoiceActivity, InvoiceLine, InvoiceReminder
from .order_selectors import money_totals
from .pricing import ZERO


def invoice_queryset(company):
    return Invoice.objects.filter(company=company, customer__company=company, salesperson__company=company).filter(
        Q(sales_order__isnull=True) | Q(sales_order__company=company),
    ).select_related("customer", "salesperson__user", "sales_order")


def invoice_by_id(*, company, invoice_id):
    invoice = invoice_queryset(company).prefetch_related(
        Prefetch("lines", queryset=InvoiceLine.objects.filter(company=company)),
        Prefetch("activities", queryset=InvoiceActivity.objects.filter(company=company).select_related("actor")),
        Prefetch("credit_notes", queryset=CreditNote.objects.filter(company=company, customer__company=company)),
        Prefetch("reminders", queryset=InvoiceReminder.objects.filter(company=company)),
    ).filter(pk=invoice_id).first()
    if invoice is None:
        raise NotFound()
    return invoice


def payment_status(invoice):
    return "paid" if invoice.balance_due == 0 and invoice.total > 0 else "partially_paid" if invoice.amount_paid > 0 else "unpaid"


def invoice_payload(invoice, *, permissions):
    return dict(id=invoice.pk, reference=invoice.number, customerId=invoice.customer_id, customerName=invoice.customer.name,
                salesperson=salesperson_name(invoice.salesperson), invoiceDate=invoice.issue_date.isoformat(), issuedAt=invoice.issued_at,
                dueDate=invoice.due_date.isoformat(), totalAmount=invoice.total, paidAmount=invoice.amount_paid, balanceDue=invoice.balance_due, creditTotal=invoice.credit_total,
                overdue=invoice.status == "posted" and invoice.balance_due > 0 and invoice.due_date < timezone.localdate(),
                workflowStatus=invoice.status, paymentStatus=payment_status(invoice), salesOrderId=invoice.sales_order_id,
                salesOrderReference=invoice.sales_order.number if invoice.sales_order_id else None,
                capabilities=dict(canEdit=invoice.status == "draft" and "invoices.edit" in permissions,
                    canPost=invoice.status == "draft" and "invoices.post" in permissions, canSend=invoice.status == "posted" and "invoices.send" in permissions,
                    canPay=invoice.status == "posted" and invoice.balance_due > 0 and "payments.create" in permissions,
                    canRemind=invoice.status == "posted" and invoice.balance_due > 0 and invoice.due_date < timezone.localdate() and "invoices.remind" in permissions,
                    canCredit=invoice.status == "posted" and invoice.balance_due > 0 and "invoices.credit_note" in permissions))


def invoice_detail(*, invoice, membership):
    from apps.finance.models import PaymentAllocation
    from apps.notifications.models import BusinessEmail
    from apps.notifications.email_services import email_payload
    permissions = get_effective_permission_codes(membership=membership)
    allocations = PaymentAllocation.objects.filter(company_id=invoice.company_id, invoice=invoice, payment__company_id=invoice.company_id).select_related("payment") if "payments.view" in permissions else []
    return {**invoice_payload(invoice, permissions=permissions), "customerEmail": invoice.customer.email,
            "emailDeliveries": [email_payload(e) for e in BusinessEmail.objects.filter(company_id=invoice.company_id, entity_type="invoice", entity_id=invoice.pk)[:20]],
            "billingAddress": invoice.billing_address, "currency": invoice.currency, "paymentTerms": invoice.payment_terms,
            "customerReference": invoice.customer_reference, "notes": invoice.notes,
            "lines": [dict(id=str(line.pk), productId=line.product_id, productName=line.product_name, description=line.description,
                           quantity=line.quantity, unitPrice=line.unit_price, discountRate=line.discount_rate, taxRate=line.tax_rate) for line in invoice.lines.all()],
            "totals": money_totals(invoice), "payments": [dict(id=a.pk, reference=a.payment.number, date=a.payment.date.isoformat(), method=a.payment.method,
                amount=a.amount, status="cancelled" if a.reversed_at else "confirmed", note=a.payment.note, referenceExternal=a.payment.reference_external) for a in allocations],
            "deliveries": [], "creditNotes": [dict(id=c.pk, reference=c.number, amount=c.total, date=c.date.isoformat(), reason=c.reason) for c in invoice.credit_notes.all()], "documents": [],
            "reminders": [dict(id=r.pk, createdAt=r.created_at, recipient=r.recipient, status=r.status) for r in invoice.reminders.all()],
            "activities": [dict(id=str(a.pk), type=a.type, date=a.created_at.isoformat(), user=a.actor.get_full_name() or a.actor.email if a.actor else "", description=a.description) for a in invoice.activities.all()],
            "permissions": permissions, "asOf": timezone.localdate().isoformat()}


def filter_invoices(query, filters, *, company):
    if filters.get("search"):
        term = filters["search"]
        query = query.filter(Q(number__icontains=term) | Q(customer__name__icontains=term) | Q(sales_order__number__icontains=term))
    for param, field in [("customer_id", "customer_id"), ("workflow", "status")]:
        if param in filters:
            query = query.filter(**{field: filters[param]})
    if filters.get("salesperson"):
        query = query.filter(salesperson_id__in=[m.pk for m in company_salespeople(company) if salesperson_name(m) == filters["salesperson"]])
    for param, field in [("date_from", "issue_date__gte"), ("date_to", "issue_date__lte"), ("due_from", "due_date__gte"), ("due_to", "due_date__lte"), ("min_amount", "total__gte"), ("max_amount", "total__lte")]:
        if param in filters:
            query = query.filter(**{field: filters[param]})
    if filters.get("payment") == "unpaid":
        query = query.filter(amount_paid=0, balance_due__gt=0)
    elif filters.get("payment") == "partially_paid":
        query = query.filter(amount_paid__gt=0, balance_due__gt=0)
    elif filters.get("payment") == "paid":
        query = query.filter(total__gt=0, balance_due=0)
    if filters.get("aging"):
        query = query.filter(status="posted", balance_due__gt=0)
        today = timezone.localdate()
        key = filters["aging"]
        if key == "current":
            query = query.filter(due_date__gte=today)
        elif key == "90+":
            query = query.filter(due_date__lt=today - timedelta(days=90))
        else:
            lower, upper = map(int, key.split("-"))
            query = query.filter(due_date__gte=today - timedelta(days=upper), due_date__lte=today - timedelta(days=lower))
    return query.order_by(filters.get("ordering", "-issue_date"), "pk")


def invoice_aging(*, company):
    buckets = {key: dict(key=key, label=label, count=0, amount=ZERO) for key, label in [("current", "Non échues"), ("1-30", "1–30 jours"), ("31-60", "31–60 jours"), ("61-90", "61–90 jours"), ("90+", "90+ jours")]}
    today = timezone.localdate()
    for due, balance in invoice_queryset(company).filter(status="posted", balance_due__gt=0).values_list("due_date", "balance_due"):
        days = (today - due).days
        key = "current" if days <= 0 else "1-30" if days <= 30 else "31-60" if days <= 60 else "61-90" if days <= 90 else "90+"
        buckets[key]["count"] += 1
        buckets[key]["amount"] += balance
    return list(buckets.values())
