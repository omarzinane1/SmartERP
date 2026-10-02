from django.db.models import Prefetch, Q
from django.utils import timezone
from rest_framework.exceptions import NotFound
from apps.accounts.selectors import get_effective_permission_codes
from apps.crm.selectors import company_salespeople, salesperson_name
from apps.inventory.models import Product
from .models import Quote, QuoteActivity, QuoteLine, SalesOrder


def quote_queryset(company):
    return Quote.objects.filter(company=company, customer__company=company, salesperson__company=company).select_related(
        "customer", "salesperson__user",
    )


def quote_by_id(*, company, quote_id):
    quote = quote_queryset(company).prefetch_related(
        Prefetch("lines", queryset=QuoteLine.objects.filter(company=company)),
        Prefetch("activities", queryset=QuoteActivity.objects.filter(company=company).select_related("actor")),
    ).filter(pk=quote_id).first()
    if quote is None:
        raise NotFound()
    return quote


def quote_payload(quote):
    return dict(id=quote.pk, reference=quote.number, customer_id=quote.customer_id,
                customer_name=quote.customer.name, customer_email=quote.customer.email,
                salesperson=salesperson_name(quote.salesperson), created_at=quote.created_at.isoformat(),
                expires_at=quote.expires_at.isoformat(), total_amount=str(quote.total), status=quote.status)


def product_catalog(company):
    return [dict(id=p.pk, reference=p.reference, name=p.name, kind=p.kind, description=p.description,
                 unitPrice=p.unit_price, taxRate=p.tax_rate) for p in Product.objects.filter(company=company, is_active=True).order_by("name")]


def quote_detail(*, quote, membership):
    permissions = get_effective_permission_codes(membership=membership)
    converted = SalesOrder.objects.filter(company=membership.company, quote=quote).first()
    return {**quote_payload(quote), **{field: getattr(quote, field) for field in (
        "billing_address", "currency", "payment_terms", "customer_reference", "subject", "delivery_terms",
        "commercial_terms", "internal_notes", "customer_notes",
    )}, "issue_date": quote.issue_date.isoformat(),
        "lines": [dict(id=line.pk, product_id=line.product_id, description=line.description,
                       **{field: str(getattr(line, field)) for field in ("quantity", "unit_price", "discount_rate", "tax_rate", "line_total")}) for line in quote.lines.all()],
        "subtotal": str(quote.subtotal), "tax_total": str(quote.tax_total), "total": str(quote.total),
        "permissions": permissions, "as_of": timezone.localdate().isoformat(), "products": product_catalog(membership.company),
        "activities": [dict(id=str(a.pk), date=a.created_at.isoformat(), user=a.actor.get_full_name() or a.actor.email if a.actor else "", description=a.description) for a in quote.activities.all()],
        "can_accept": "quotes.accept" in permissions and quote.status in {"sent", "viewed"} and quote.expires_at >= timezone.localdate(),
        "conversion_targets": ["sales_order"] if "quotes.convert" in permissions and quote.status == "accepted" and not converted else [],
        "converted_to": dict(id=converted.pk, reference=converted.number, target="sales_order") if converted else None,
    }


def filter_quotes(query, filters, *, company):
    if filters.get("search"):
        term = filters["search"]
        query = query.filter(Q(number__icontains=term) | Q(customer__name__icontains=term))
    if filters.get("status") and filters["status"] != "all":
        query = query.filter(status=filters["status"])
    if filters.get("customer"):
        query = query.filter(customer_id=filters["customer"])
    if filters.get("salesperson"):
        query = query.filter(salesperson_id__in=[m.pk for m in company_salespeople(company) if salesperson_name(m) == filters["salesperson"]])
    for field, lookup in [("created_after", "gte"), ("created_before", "lte")]:
        if field in filters:
            query = query.filter(**{f"created_at__date__{lookup}": filters[field]})
    ordering = filters.get("ordering", "-created_at").replace("reference", "number").replace("total_amount", "total")
    return query.order_by(ordering, "pk")
