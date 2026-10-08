"""Commercial validation and credits. No general-ledger or email side effects."""
from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError
from apps.accounts.services import require_actor
from apps.companies.models import Company
from apps.companies.sequences import next_document_number
from apps.companies.settings_selectors import settings_records
from common.exceptions import BusinessConflict
from common.idempotency import replay, request_identity
from .models import CreditNote, CreditNoteLine, Invoice, InvoiceActivity, InvoiceReminder
from .order_services import TOTAL_FIELDS, LINE_FIELDS
from .pricing import CENT, ZERO, document_totals, line_amounts


def locked_invoice(company, invoice_id):
    invoice = Invoice.objects.select_for_update().filter(
        company=company, pk=invoice_id, customer__company=company, salesperson__company=company,
    ).first()
    if invoice is None or (invoice.sales_order_id and invoice.sales_order.company_id != company.pk):
        raise NotFound()
    return invoice


def invoice_activity(invoice, membership, kind, description):
    InvoiceActivity.objects.create(company_id=invoice.company_id, invoice=invoice,
                                   actor_id=membership.user_id, type=kind, description=description)


@transaction.atomic
def post_invoice(*, company, membership, invoice_id):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="invoices.post")
    invoice = locked_invoice(company, invoice_id)
    if invoice.status != "draft":
        raise BusinessConflict("Seule une facture brouillon peut être validée.")
    lines = list(invoice.lines.select_for_update(of=("self",)).select_related("product"))
    if not lines or any(l.company_id != company.pk or (l.product_id and l.product.company_id != company.pk) for l in lines):
        raise BusinessConflict("La facture doit contenir des lignes valides de cette société.")
    if invoice.customer.status == "archived" or invoice.currency != company.currency or invoice.currency != "MAD":
        raise ValidationError("Client ou devise non éligible.")
    if invoice.due_date < invoice.issue_date or invoice.issue_date > timezone.localdate():
        raise ValidationError("Dates de facture invalides pour la validation.")
    if invoice.amount_paid or invoice.credit_total:
        raise BusinessConflict("Un brouillon ne peut pas avoir de règlement ou d'avoir.")
    for line in lines:
        amounts = line_amounts({field: getattr(line, field) for field in LINE_FIELDS})
        for field, value in amounts.items():
            setattr(line, field, value)
        line.save(update_fields=list(amounts))
    totals = document_totals([{field: getattr(l, field) for field in LINE_FIELDS} for l in lines])
    if totals["total"] <= 0:
        raise ValidationError("Le total de la facture doit être positif.")
    for field, value in totals.items():
        setattr(invoice, field, value)
    if not invoice.number:
        config = settings_records(company)["invoices"]
        invoice.number = next_document_number(company=company, kind="invoice", prefix=config.invoice_prefix, start=config.invoice_start)
    invoice.balance_due = invoice.total
    invoice.status, invoice.issued_at = "posted", timezone.now()
    invoice.save()
    invoice_activity(invoice, membership, "posted", "Facture commerciale validée et figée.")
    return invoice


@transaction.atomic
def create_credit_note(*, company, membership, invoice_id, data, key):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="invoices.credit_note")
    invoice = locked_invoice(company, invoice_id)
    key, fingerprint = request_identity(key, {"invoice": invoice_id, **data})
    existing = replay(CreditNote.objects.filter(company=company), key, fingerprint)
    if existing:
        return existing
    if invoice.status != "posted" or invoice.balance_due <= 0:
        raise BusinessConflict("Facture non éligible à un avoir sur solde non réglé.")
    if data["date"] < invoice.issue_date or data["date"] > timezone.localdate():
        raise ValidationError({"date": ["Date d'avoir invalide."]})
    source = {l.pk: l for l in invoice.lines.select_for_update(of=("self",)).select_related("product")}
    if any(l.company_id != company.pk or (l.product_id and l.product.company_id != company.pk) for l in source.values()):
        raise BusinessConflict("Lignes source incohérentes.")
    used = {v["original_line_id"]: v for v in CreditNoteLine.objects.filter(company=company, credit_note__original_invoice=invoice).values("original_line_id").annotate(quantity_sum=Sum("quantity"))}
    requested = data.get("lines") or [dict(line_id=pk, quantity=l.quantity - used.get(pk, {}).get("quantity_sum", ZERO)) for pk, l in source.items() if l.quantity > used.get(pk, {}).get("quantity_sum", ZERO)]
    rows = []
    seen = set()
    for item in requested:
        pk, quantity = item["line_id"], item["quantity"]
        if pk not in source:
            raise NotFound("Ligne de facture introuvable.")
        if pk in seen:
            raise ValidationError("Ligne d'avoir dupliquée.")
        seen.add(pk)
        line = source[pk]
        before = used.get(pk, {}).get("quantity_sum", ZERO)
        after = before + quantity
        if quantity <= 0 or after > line.quantity:
            raise BusinessConflict("Quantité créditée supérieure au restant autorisé.")
        # Cumulative prorating of the original rounded components preserves every
        # cent across fractional credits, including the final residual quantity.
        def component(field):
            value = getattr(line, field)
            return (value * after / line.quantity).quantize(CENT, rounding=ROUND_HALF_UP) - (value * before / line.quantity).quantize(CENT, rounding=ROUND_HALF_UP)
        gross, discount, net, tax = (component(f) for f in ("gross_total", "discount_total", "subtotal", "tax_total"))
        rows.append(dict(company=company, original_line=line, position=len(rows) + 1,
                         **{f: getattr(line, f) for f in ("product_id", "product_name", "description", "unit_price", "discount_rate", "tax_rate")},
                         quantity=quantity, gross_total=gross, discount_total=discount, subtotal=net, tax_total=tax, line_total=net + tax))
    totals = document_totals(rows)
    if not rows or totals["total"] <= 0 or totals["total"] > invoice.balance_due:
        raise BusinessConflict("L'avoir doit être positif et ne peut dépasser le solde non réglé. Les remboursements ne sont pas disponibles.")
    credit = CreditNote.objects.create(company=company, customer=invoice.customer, original_invoice=invoice,
        number=next_document_number(company=company, kind="credit_note", prefix="CN"), date=data["date"],
        currency=invoice.currency, reason=data["reason"], created_by_id=membership.user_id,
        operation_key=key, request_fingerprint=fingerprint, **totals)
    CreditNoteLine.objects.bulk_create([CreditNoteLine(credit_note=credit, **row) for row in rows])
    invoice.credit_total = CreditNote.objects.filter(company=company, original_invoice=invoice).aggregate(value=Sum("total"))["value"] or ZERO
    invoice.balance_due = invoice.total - invoice.amount_paid - invoice.credit_total
    invoice.save(update_fields=["credit_total", "balance_due", "updated_at"])
    invoice_activity(invoice, membership, "edited", f"Avoir {credit.number} validé : {credit.total} {credit.currency}.")
    return credit


@transaction.atomic
def request_reminder(*, company, membership, invoice_id, key):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="invoices.remind")
    invoice = locked_invoice(company, invoice_id)
    key, fingerprint = request_identity(key, {"invoice": invoice_id})
    existing = replay(InvoiceReminder.objects.filter(company=company), key, fingerprint)
    if existing:
        return existing
    from common.dates import company_today
    if invoice.status != "posted" or invoice.balance_due <= 0 or invoice.due_date >= company_today(company):
        raise BusinessConflict("Seule une facture échue avec un solde positif peut être relancée.")
    reminder = InvoiceReminder.objects.create(company=company, invoice=invoice, created_by_id=membership.user_id,
        recipient=invoice.customer.email, operation_key=key, request_fingerprint=fingerprint)
    from common.dispatch import enqueue_after_commit
    from .tasks import send_invoice_reminder_email
    enqueue_after_commit(send_invoice_reminder_email, reminder.pk, failed=lambda: InvoiceReminder.objects.filter(pk=reminder.pk, status="requested").update(status="failed", email_error_code="broker_unavailable"))
    invoice_activity(invoice, membership, "reminder", "Relance demandée ; envoi traité en arrière-plan selon la configuration e-mail.")
    return reminder
