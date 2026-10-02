from decimal import Decimal

from django.db.models import Avg, DecimalField, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework.exceptions import NotFound
from apps.accounts.models import Membership
from apps.accounts.selectors import get_effective_permission_codes
from .models import Customer
from apps.sales.models import Invoice, InvoiceActivity, Quote, QuoteActivity, SalesOrder, SalesOrderActivity


def salesperson_name(membership):
    if membership is None:
        return ""
    return membership.display_name or membership.user.get_full_name() or membership.user.email


def company_salespeople(company):
    return list(Membership.objects.filter(company=company, status="active", user__is_active=True).select_related("user").order_by("pk"))


def customers_queryset(company):
    money = DecimalField(max_digits=18, decimal_places=2)
    ledger = Invoice.objects.filter(company=company, customer_id=OuterRef("pk"), status="posted", currency=company.currency)
    today = timezone.localdate()
    def amount(query, field):
        summed = query.order_by().values("customer_id").annotate(value=Sum(field)).values("value")[:1]
        return Coalesce(Subquery(summed, output_field=money), Value(Decimal("0.00")), output_field=money)
    return Customer.objects.filter(company=company).select_related("salesperson__user", "created_by").annotate(
        revenue=amount(ledger.filter(issue_date__year=today.year), "total"),
        outstanding=amount(ledger, "balance_due"),
        overdue=amount(ledger.filter(due_date__lt=today), "balance_due"),
    )


def customer_by_id(*, company, customer_id):
    customer = customers_queryset(company).filter(pk=customer_id).first()
    if customer is None:
        raise NotFound()
    return customer


def filter_customers(query, filters, *, company):
    if filters.get("search"):
        search = filters["search"]
        query = query.filter(Q(name__icontains=search) | Q(reference__icontains=search) | Q(email__icontains=search) | Q(phone__icontains=search) | Q(city__icontains=search) | Q(tags__contains=[search]))
    for field in ("status", "city"):
        if filters.get(field) and filters[field] != "all":
            query = query.filter(**{field: filters[field]})
    if filters.get("salesperson") and filters["salesperson"] != "all":
        members = company_salespeople(company)
        ids = [m.pk for m in members if salesperson_name(m) == filters["salesperson"]]
        query = query.filter(salesperson_id__in=ids)
    for field in ("outstanding", "overdue"):
        if filters.get(field):
            query = query.filter(**{f"{field}__gt": 0})
    return query.order_by(filters.get("ordering", "-created_at"), "pk")


def customer_payload(customer):
    return dict(id=customer.pk, reference=customer.reference, name=customer.name, type=customer.type,
                phone=customer.phone, email=customer.email, city=customer.city, district=customer.district,
                salesperson=salesperson_name(customer.salesperson), revenue=customer.revenue,
                outstanding=customer.outstanding, overdue=customer.overdue,
                lastActivity=customer.updated_at.isoformat(), activity="Fiche client mise à jour", createdAt=customer.created_at.isoformat(),
                status=customer.status, previousStatus=customer.previous_status, tags=customer.tags)


def customers_metadata(*, company, membership):
    now = timezone.now()
    return dict(permissions=get_effective_permission_codes(membership=membership),
                salespeople=sorted({salesperson_name(m) for m in company_salespeople(company)}),
                currentSalesperson=salesperson_name(membership),
                period=dict(asOf=now.date().isoformat(), syncedAt=now.isoformat(), label="Portefeuille actuel"),
                revenueGrowth=None, dsoDays=None, dsoTarget=None)


def customer_detail(*, customer, membership):
    meta = customers_metadata(company=customer.company, membership=membership)
    permissions = meta["permissions"]
    orders = list(SalesOrder.objects.filter(company=membership.company, customer=customer).select_related("salesperson__user").order_by("-created_at")) if "sales.view" in permissions else []
    quotes = list(Quote.objects.filter(company=membership.company, customer=customer).select_related("salesperson__user").order_by("-created_at")) if "quotes.view" in permissions else []
    invoices = list(Invoice.objects.filter(company=membership.company, customer=customer).order_by("-issue_date")) if "invoices.view" in permissions else []
    sales = [dict(reference=o.number, kind="order", date=o.created_at.date().isoformat(), salesperson=salesperson_name(o.salesperson), amount=o.total,
                  margin=None, status={"draft": "Draft", "confirmed": "Confirmed", "processing": "Processing", "completed": "Completed", "cancelled": "Cancelled"}[o.status], paymentStatus="Unpaid") for o in orders]
    sales += [dict(reference=q.number, kind="quote", date=q.issue_date.isoformat(), salesperson=salesperson_name(q.salesperson), amount=q.total,
                   margin=None, status=q.status.capitalize(), paymentStatus="Not due") for q in quotes]
    def invoice_status(invoice):
        if invoice.status != "posted":
            return "Draft" if invoice.status == "draft" else "Cancelled"
        if invoice.balance_due <= 0:
            return "Paid"
        if invoice.due_date < timezone.localdate():
            return "Overdue"
        return "Partially Paid" if invoice.amount_paid > 0 else "Posted"
    return {**customer_payload(customer), **{key: meta[key] for key in ("permissions", "salespeople")},
            "country": customer.country, "industry": customer.industry, "taxId": customer.tax_id,
            "website": customer.website, "address": customer.address, "segment": customer.segment,
            "paymentTerms": customer.payment_terms, "currency": customer.currency,
            "preferredContact": customer.preferred_contact, "primaryContact": None,
            "lastOrder": orders[0].created_at.isoformat() if orders else None, "lastPayment": None, "sales": sales,
            "invoices": [dict(reference=i.number, date=i.issue_date.isoformat(), dueDate=i.due_date.isoformat(), amount=i.total,
                              paid=i.amount_paid, outstanding=i.balance_due, status=invoice_status(i)) for i in invoices],
            "payments": [], "documents": [], "notes": [], "nextActions": []}


def customer_summary(*, customer, membership):
    orders = SalesOrder.objects.filter(company=membership.company, customer=customer).exclude(status="cancelled")
    previous = Invoice.objects.filter(company=membership.company, customer=customer, status="posted", currency=customer.company.currency,
                                      issue_date__year=timezone.localdate().year - 1).aggregate(value=Sum("total"))["value"]
    return dict(asOf=timezone.localdate().isoformat(), customerScore=None, paymentReliability=None,
                revenue=customer.revenue, revenueGrowth=((customer.revenue - previous) / previous * 100).quantize(Decimal("0.01")) if previous else None,
                averageOrderValue=orders.aggregate(value=Avg("total"))["value"],
                outstanding=customer.outstanding, overdue=customer.overdue, paymentDelay=None,
                previousPaymentDelay=None, profitability=None, totalOrders=orders.count(), creditLimit=None)


def customer_activity(*, customer, membership):
    events = [dict(id=f"customer-{customer.pk}-created", type="note", title="Fiche client créée",
                 description=customer.name, user=customer.created_by.get_full_name() or customer.created_by.email if customer.created_by else "",
                 createdAt=customer.created_at.isoformat(), record=customer.reference, permissions=["customers.view"])]
    permissions = get_effective_permission_codes(membership=membership)
    sources = [(QuoteActivity, "quote", "quote", "quotes.view"), (SalesOrderActivity, "order", "sale", "sales.view"), (InvoiceActivity, "invoice", "invoice", "invoices.view")]
    for model, relation, kind, permission in sources:
        if permission not in permissions:
            continue
        for event in model.objects.filter(company=membership.company, **{f"{relation}__company": membership.company, f"{relation}__customer": customer}).select_related("actor", relation):
            events.append(dict(id=f"{kind}-{event.pk}", type=kind, title=event.description, description=event.description,
                               user=event.actor.get_full_name() or event.actor.email if event.actor else "",
                               createdAt=event.created_at.isoformat(), record=getattr(event, relation).number, permissions=[permission]))
    return sorted(events, key=lambda event: event["createdAt"], reverse=True)
