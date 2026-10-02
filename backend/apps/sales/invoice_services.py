from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError
from apps.accounts.services import require_actor
from apps.companies.models import Company
from apps.companies.sequences import next_document_number
from apps.companies.settings_selectors import settings_records
from apps.crm.models import Customer
from common.exceptions import BusinessConflict
from .models import Invoice, InvoiceActivity, InvoiceLine, SalesOrderActivity
from .order_services import LINE_FIELDS, TOTAL_FIELDS, locked_order
from .pricing import document_totals
from .services import prepare_lines, resolve_salesperson


@transaction.atomic
def save_invoice(*, company, membership, data, invoice_id=None):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="invoices.edit" if invoice_id else "invoices.create")
    if invoice_id:
        invoice = Invoice.objects.select_for_update().filter(company=company, pk=invoice_id, customer__company=company, salesperson__company=company).first()
        if invoice is None:
            raise NotFound()
    else:
        invoice = Invoice(company=company)
    if invoice.status != "draft":
        raise BusinessConflict("Seules les factures brouillon sont modifiables.")
    values = dict(data)
    if "customer_id" in values:
        customer = Customer.objects.filter(company=company, pk=values.pop("customer_id")).first()
        if customer is None:
            raise NotFound("Client introuvable.")
        if customer.status == "archived":
            raise ValidationError({"customer_id": ["Client archivé."]})
        if invoice.sales_order_id and invoice.customer_id != customer.pk:
            raise BusinessConflict("Le client doit rester celui de la commande source.")
        invoice.customer = customer
    if "salesperson" in values:
        invoice.salesperson = resolve_salesperson(company=company, name=values.pop("salesperson"))
    lines = prepare_lines(company=company, lines=values.pop("lines")) if "lines" in values else None
    if invoice.sales_order_id and lines is not None:
        old = list(invoice.lines.order_by("position"))
        compared = ("product_id", "product_name", "description", "quantity", "unit_price", "discount_rate", "tax_rate")
        if len(old) != len(lines) or any(any(getattr(a, key) != b[key] for key in compared) for a, b in zip(old, lines)):
            raise BusinessConflict("Les lignes reprises de la commande ne peuvent pas être modifiées dans ce jalon.")
    for field, value in values.items():
        setattr(invoice, field, value)
    if invoice.due_date < invoice.issue_date:
        raise ValidationError({"due_date": ["L'échéance doit suivre la date de facture."]})
    if invoice.currency != company.currency:
        raise ValidationError({"currency": ["Devise incompatible avec la société."]})
    if invoice_id is None:
        config = settings_records(company)["invoices"]
        invoice.number = next_document_number(company=company, kind="invoice", prefix=config.invoice_prefix, start=config.invoice_start)
    if lines is not None:
        for field, amount in document_totals(lines).items():
            setattr(invoice, field, amount)
    invoice.balance_due = invoice.total - invoice.amount_paid
    invoice.save()
    if lines is not None:
        invoice.lines.all().delete()
        InvoiceLine.objects.bulk_create([InvoiceLine(invoice=invoice, **line) for line in lines])
    InvoiceActivity.objects.create(company=company, invoice=invoice, actor_id=membership.user_id,
                                   type="edited" if invoice_id else "created", description="Facture brouillon modifiée." if invoice_id else "Facture brouillon créée.")
    return invoice


@transaction.atomic
def create_invoice_from_order(*, company, membership, order_id, amount):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="invoices.create")
    order = locked_order(company=company, order_id=order_id)
    if order.status not in {"confirmed", "processing"}:
        raise BusinessConflict("La commande doit être confirmée avant la facturation.")
    if Invoice.objects.filter(sales_order=order).exclude(status="cancelled").exists():
        raise BusinessConflict("Une facture existe déjà pour cette commande.")
    if amount != order.total:
        raise ValidationError({"amount": ["La facture doit reprendre le montant intégral de la commande."]})
    source_lines = list(order.lines.select_related("product").all())
    if not source_lines or any(line.company_id != company.pk or (line.product_id and line.product.company_id != company.pk) for line in source_lines):
        raise BusinessConflict("Lignes de commande incohérentes.")
    totals = document_totals([{field: getattr(line, field) for field in LINE_FIELDS} for line in source_lines])
    if any(totals[field] != getattr(order, field) for field in TOTAL_FIELDS):
        raise BusinessConflict("Les totaux de la commande doivent être vérifiés.")
    config = settings_records(company)["invoices"]
    invoice = Invoice.objects.create(
        company=company, customer=order.customer, salesperson=order.salesperson, sales_order=order,
        number=next_document_number(company=company, kind="invoice", prefix=config.invoice_prefix, start=config.invoice_start),
        issue_date=timezone.localdate(), due_date=timezone.localdate() + timedelta(days=config.default_due_days),
        currency=order.currency, customer_reference=order.customer_reference, billing_address=order.billing_address,
        payment_terms=order.payment_terms, notes=order.notes, balance_due=order.total,
        **{field: getattr(order, field) for field in TOTAL_FIELDS},
    )
    InvoiceLine.objects.bulk_create([InvoiceLine(invoice=invoice, company=company, **{field: getattr(line, field) for field in LINE_FIELDS}) for line in source_lines])
    InvoiceActivity.objects.create(company=company, invoice=invoice, actor_id=membership.user_id, type="created", description=f"Facture brouillon créée depuis {order.number}.")
    SalesOrderActivity.objects.create(company=company, order=order, actor_id=membership.user_id, type="invoice", description=f"Facture brouillon {invoice.number} créée.")
    return invoice
