from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError
from apps.accounts.services import require_actor
from apps.companies.models import Company
from apps.companies.sequences import next_document_number
from apps.companies.settings_selectors import settings_records
from apps.crm.models import Customer
from common.exceptions import BusinessConflict
from .models import Invoice, QuoteActivity, SalesOrder, SalesOrderActivity, SalesOrderLine
from .pricing import document_totals
from .services import locked_quote, prepare_lines, resolve_salesperson

TOTAL_FIELDS = ("gross_total", "discount_total", "subtotal", "tax_total", "total")
LINE_FIELDS = ("position", "product_id", "product_name", "description", "quantity", "unit_price", "discount_rate", "tax_rate", "gross_total", "discount_total", "subtotal", "tax_total", "line_total")


def locked_order(*, company, order_id):
    order = SalesOrder.objects.select_for_update().filter(pk=order_id, company=company, customer__company=company, salesperson__company=company).first()
    if order is None:
        raise NotFound()
    return order


@transaction.atomic
def convert_quote(*, company, membership, quote_id):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="quotes.convert")
    quote = locked_quote(company=company, quote_id=quote_id)
    if quote.status != "accepted":
        raise BusinessConflict("Seul un devis accepté peut être converti.")
    if SalesOrder.objects.filter(quote=quote).exists():
        raise BusinessConflict("Ce devis a déjà été converti.")
    source_lines = list(quote.lines.select_related("product").all())
    if not source_lines or any(line.company_id != company.pk or (line.product_id and line.product.company_id != company.pk) for line in source_lines):
        raise BusinessConflict("Les lignes du devis ne sont pas cohérentes avec cette société.")
    totals = document_totals([{field: getattr(line, field) for field in LINE_FIELDS} for line in source_lines])
    if any(totals[field] != getattr(quote, field) for field in TOTAL_FIELDS):
        raise BusinessConflict("Les totaux du devis doivent être vérifiés.")
    config = settings_records(company)["sales"]
    order = SalesOrder.objects.create(
        company=company, customer=quote.customer, quote=quote, salesperson=quote.salesperson,
        number=next_document_number(company=company, kind="sales_order", prefix=config.order_prefix),
        currency=quote.currency, customer_reference=quote.customer_reference, billing_address=quote.billing_address,
        payment_terms=quote.payment_terms, notes=quote.customer_notes,
        **{field: getattr(quote, field) for field in TOTAL_FIELDS},
    )
    SalesOrderLine.objects.bulk_create([SalesOrderLine(order=order, company=company, **{field: getattr(line, field) for field in LINE_FIELDS}) for line in source_lines])
    SalesOrderActivity.objects.create(company=company, order=order, actor_id=membership.user_id, type="created", description=f"Commande créée depuis {quote.number}.")
    QuoteActivity.objects.create(company=company, quote=quote, actor_id=membership.user_id, description=f"Devis converti en {order.number}.")
    return order


@transaction.atomic
def save_sales_order(*, company, membership, data, order_id=None):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="sales.edit")
    order = locked_order(company=company, order_id=order_id) if order_id else SalesOrder(company=company)
    if order.status != "draft":
        raise BusinessConflict("Seules les commandes brouillon sont modifiables.")
    values = dict(data)
    if "customer_id" in values:
        customer = Customer.objects.filter(pk=values.pop("customer_id"), company=company).first()
        if customer is None:
            raise NotFound("Client introuvable.")
        if customer.status == "archived":
            raise ValidationError({"customer_id": ["Client archivé."]})
        if order.quote_id and customer.pk != order.customer_id:
            raise BusinessConflict("Le client doit rester celui du devis source.")
        order.customer = customer
    if "salesperson" in values:
        order.salesperson = resolve_salesperson(company=company, name=values.pop("salesperson"))
    lines = prepare_lines(company=company, lines=values.pop("lines")) if "lines" in values else None
    for field, value in values.items():
        setattr(order, field, value)
    if order.currency != company.currency:
        raise ValidationError({"currency": ["Devise incompatible avec la société."]})
    if order_id is None:
        order.number = next_document_number(company=company, kind="sales_order", prefix=settings_records(company)["sales"].order_prefix)
    if lines is not None:
        for field, amount in document_totals(lines).items():
            setattr(order, field, amount)
    order.save()
    if lines is not None:
        order.lines.all().delete()
        SalesOrderLine.objects.bulk_create([SalesOrderLine(order=order, **line) for line in lines])
    SalesOrderActivity.objects.create(company=company, order=order, actor_id=membership.user_id,
                                     type="note" if order_id else "created", description="Commande modifiée." if order_id else "Commande créée.")
    return order


@transaction.atomic
def transition_sales_order(*, company, membership, order_id, action):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="sales.edit")
    order = locked_order(company=company, order_id=order_id)
    allowed = {"confirm": {"draft"}, "processing": {"confirmed"}, "cancel": {"draft", "confirmed"}}
    if order.status not in allowed[action]:
        raise BusinessConflict("Transition de commande invalide.")
    if action == "cancel" and Invoice.objects.filter(company=company, sales_order=order).exclude(status="cancelled").exists():
        raise BusinessConflict("Une commande liée à une facture active ne peut pas être annulée.")
    order.status = {"confirm": "confirmed", "processing": "processing", "cancel": "cancelled"}[action]
    if action == "confirm":
        if not order.lines.filter(company=company).exists():
            raise BusinessConflict("La commande ne contient aucune ligne.")
        order.confirmed_at = timezone.now()
    order.save(update_fields=["status", "confirmed_at", "updated_at"])
    SalesOrderActivity.objects.create(company=company, order=order, actor_id=membership.user_id,
                                     type={"confirm": "confirmed", "processing": "note", "cancel": "cancelled"}[action],
                                     description={"confirm": "Commande confirmée.", "processing": "Préparation de la commande démarrée.", "cancel": "Commande annulée."}[action])
    return order


def confirm_sales_order(**kwargs):
    return transition_sales_order(**kwargs, action="confirm")


def cancel_sales_order(**kwargs):
    return transition_sales_order(**kwargs, action="cancel")


def mark_processing(**kwargs):
    return transition_sales_order(**kwargs, action="processing")
