from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError
from apps.accounts.services import require_actor
from apps.companies.models import Company
from apps.companies.sequences import next_document_number
from apps.companies.settings_selectors import settings_records
from apps.crm.models import Customer
from apps.crm.selectors import company_salespeople, salesperson_name
from apps.inventory.models import Product
from common.exceptions import BusinessConflict
from .models import Quote, QuoteActivity, QuoteLine
from .pricing import document_totals, line_amounts


def resolve_salesperson(*, company, name):
    matches = [m for m in company_salespeople(company) if salesperson_name(m) == name]
    if len(matches) != 1:
        raise ValidationError({"salesperson": ["Commercial inconnu ou ambigu dans cette société."]})
    return matches[0]


def prepare_lines(*, company, lines):
    ids = {line["product_id"] for line in lines if line.get("product_id")}
    products = {p.pk: p for p in Product.objects.filter(company=company, pk__in=ids, is_active=True)}
    if ids - products.keys():
        raise NotFound("Produit introuvable.")
    prepared = []
    for position, line in enumerate(lines, 1):
        values = dict(line)
        product = products.get(values.get("product_id"))
        values["product_name"] = product.name if product else values.get("product_name") or values["description"][:255]
        if not values["description"] and product:
            values["description"] = product.description or product.name
        prepared.append({**values, **line_amounts(values), "position": position, "company": company})
    return prepared


def locked_quote(*, company, quote_id):
    quote = Quote.objects.select_for_update().filter(pk=quote_id, company=company, customer__company=company, salesperson__company=company).first()
    if quote is None:
        raise NotFound()
    return quote


@transaction.atomic
def save_quote(*, company, membership, data, quote_id=None):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="quotes.edit" if quote_id else "quotes.create")
    quote = locked_quote(company=company, quote_id=quote_id) if quote_id else Quote(company=company)
    if quote.status != "draft":
        raise BusinessConflict("Seuls les brouillons peuvent être modifiés.")
    values = dict(data)
    if "customer_id" in values:
        customer = Customer.objects.filter(pk=values.pop("customer_id"), company=company).first()
        if customer is None:
            raise NotFound("Client introuvable.")
        if customer.status == "archived":
            raise ValidationError({"customer_id": ["Ce client est archivé."]})
        quote.customer = customer
    if "salesperson" in values:
        quote.salesperson = resolve_salesperson(company=company, name=values.pop("salesperson"))
    lines = prepare_lines(company=company, lines=values.pop("lines")) if "lines" in values else None
    for field, value in values.items():
        setattr(quote, field, value)
    if quote.expires_at < quote.issue_date:
        raise ValidationError({"expires_at": ["L'expiration doit suivre la date du devis."]})
    if quote.currency != company.currency:
        raise ValidationError({"currency": ["La devise doit correspondre à celle de la société."]})
    if quote_id is None:
        config = settings_records(company)["invoices"]
        quote.number = next_document_number(company=company, kind="quote", prefix=config.quote_prefix, start=config.quote_start)
    if lines is not None:
        for field, amount in document_totals(lines).items():
            setattr(quote, field, amount)
    quote.save()
    if lines is not None:
        quote.lines.all().delete()
        QuoteLine.objects.bulk_create([QuoteLine(quote=quote, **line) for line in lines])
    QuoteActivity.objects.create(company=company, quote=quote, actor_id=membership.user_id,
                                 description="Devis modifié." if quote_id else "Devis créé.")
    return quote


@transaction.atomic
def transition_quote(*, company, membership, quote_id, action):
    Company.objects.select_for_update().get(pk=company.pk)
    permissions = {"send": "quotes.send", "accept": "quotes.accept", "reject": "quotes.accept", "viewed": "quotes.edit", "expire": "quotes.edit"}
    require_actor(company=company, actor=membership, permission_code=permissions[action])
    quote = locked_quote(company=company, quote_id=quote_id)
    if action == "send" and quote.status in {"sent", "viewed"} and quote.expires_at >= timezone.localdate():
        return quote  # Recording dispatch twice must not duplicate an event.
    sources = {"send": {"draft"}, "accept": {"sent", "viewed"}, "reject": {"sent", "viewed"}, "viewed": {"sent"}, "expire": {"draft", "sent", "viewed"}}
    if quote.status not in sources[action]:
        raise BusinessConflict("Transition de devis invalide.")
    expired = quote.expires_at < timezone.localdate()
    if action in {"send", "accept", "viewed"} and expired:
        raise BusinessConflict("Le devis a expiré.")
    if action == "expire" and not expired:
        raise BusinessConflict("Le devis n'a pas encore expiré.")
    quote.status = {"send": "sent", "accept": "accepted", "reject": "rejected", "viewed": "viewed", "expire": "expired"}[action]
    quote.save(update_fields=["status", "updated_at"])
    messages = {"send": "Devis marqué comme envoyé (envoi externe).", "accept": "Devis accepté.", "reject": "Devis refusé.", "viewed": "Consultation du devis enregistrée.", "expire": "Devis expiré."}
    QuoteActivity.objects.create(company=company, quote=quote, actor_id=membership.user_id, description=messages[action])
    return quote


def send_quote(**kwargs):
    return transition_quote(**kwargs, action="send")


def accept_quote(**kwargs):
    return transition_quote(**kwargs, action="accept")


@transaction.atomic
def duplicate_quote(*, company, membership, quote_id):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="quotes.create")
    source = locked_quote(company=company, quote_id=quote_id)
    from datetime import timedelta
    data = {field: getattr(source, field) for field in ("customer_id", "billing_address", "currency", "payment_terms", "customer_reference", "subject", "delivery_terms", "commercial_terms", "internal_notes", "customer_notes")}
    data.update(salesperson=salesperson_name(source.salesperson), issue_date=timezone.localdate(),
                expires_at=timezone.localdate() + timedelta(days=settings_records(company)["sales"].quote_validity_days),
                lines=[{field: getattr(line, field) for field in ("product_id", "description", "quantity", "unit_price", "discount_rate", "tax_rate")} for line in source.lines.filter(company=company)])
    return save_quote(company=company, membership=membership, data=data)
