from datetime import timedelta
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError
from apps.accounts.services import require_actor
from apps.companies.models import Company
from apps.companies.sequences import next_document_number
from apps.sales.services import prepare_lines
from apps.sales.pricing import document_totals, ZERO
from apps.sales.order_services import LINE_FIELDS
from common.exceptions import BusinessConflict
from common.idempotency import request_identity, replay
from .models import Supplier, SupplierInvoice, SupplierInvoiceLine, SupplierInvoiceActivity
from .services import locked_order


def locked_supplier_invoice(company, invoice_id):
    invoice = SupplierInvoice.objects.select_for_update(of=("self",)).filter(company=company, pk=invoice_id, supplier__company=company).first()
    if invoice is None or (invoice.order_id and invoice.order.company_id != company.pk):
        raise NotFound()
    return invoice


def invoice_activity(invoice, membership, title, detail):
    SupplierInvoiceActivity.objects.create(company_id=invoice.company_id, invoice=invoice, actor_id=membership.user_id, title=title, detail=detail)


def validate_purchase_links(company, invoice, lines):
    linked = [line for line in lines if line.get("purchase_line_id")]
    if not invoice.order_id:
        if linked:
            raise ValidationError("Une commande est requise pour ces lignes.")
        return
    order = locked_order(company, invoice.order_id)
    if order.supplier_id != invoice.supplier_id or order.status != "confirmed":
        raise BusinessConflict("Commande confirmée du même fournisseur requise.")
    if len(linked) != len(lines):
        raise ValidationError("Chaque ligne doit appartenir à la commande liée.")
    source = {l.pk: l for l in order.lines.select_for_update()}
    seen = set()
    for line in linked:
        pk = line["purchase_line_id"]
        if pk not in source or source[pk].company_id != company.pk:
            raise NotFound("Ligne de commande introuvable.")
        if pk in seen:
            raise ValidationError("Ligne de commande dupliquée.")
        seen.add(pk)
        used = SupplierInvoiceLine.objects.filter(company=company, purchase_line_id=pk).exclude(invoice_id=invoice.pk).exclude(invoice__status="cancelled").aggregate(value=Sum("quantity"))["value"] or ZERO
        if line["quantity"] > source[pk].received_quantity - used:
            raise BusinessConflict("Quantité supérieure au reçu restant à facturer (brouillons inclus).")
        if line.get("product_id") != source[pk].product_id:
            raise ValidationError("Le produit doit correspondre à la ligne de commande.")


@transaction.atomic
def save_supplier_invoice(*, company, membership, data, key=None, invoice_id=None):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="supplier_invoices.edit" if invoice_id else "supplier_invoices.create")
    if invoice_id:
        invoice = locked_supplier_invoice(company, invoice_id)
        if invoice.status != "draft":
            raise BusinessConflict("Seule une facture brouillon est modifiable.")
    else:
        key, fingerprint = request_identity(key, data)
        previous = replay(SupplierInvoice.objects.filter(company=company), key, fingerprint)
        if previous:
            return previous
        invoice = SupplierInvoice(company=company, created_by_id=membership.user_id, operation_key=key, request_fingerprint=fingerprint)
    values = dict(data)
    if "supplier_id" in values:
        supplier = Supplier.objects.filter(company=company, buyer__company=company, pk=values.pop("supplier_id")).first()
        if supplier is None:
            raise NotFound("Fournisseur introuvable.")
        if supplier.status != "active":
            raise ValidationError("Fournisseur non actif.")
        invoice.supplier = supplier
    raw_lines = values.pop("lines", None)
    for field, value in values.items():
        setattr(invoice, field, value)
    if invoice.currency != company.currency or invoice.currency != "MAD":
        raise ValidationError("Devise non prise en charge.")
    if invoice.due_date < invoice.issue_date:
        raise ValidationError("L'échéance précède la facture.")
    if SupplierInvoice.objects.filter(company=company, supplier=invoice.supplier, supplier_reference=invoice.supplier_reference).exclude(status="cancelled").exclude(pk=invoice.pk).exists() and invoice.supplier_reference:
        raise BusinessConflict("Cette référence fournisseur existe déjà.")
    if raw_lines is None:
        raw_lines = [{f: getattr(l, f) for f in (*LINE_FIELDS, "product_id", "product_name", "description", "purchase_line_id")} for l in invoice.lines.all()]
    if not raw_lines:
        raise ValidationError("La facture doit contenir des lignes.")
    validate_purchase_links(company, invoice, raw_lines)
    lines = prepare_lines(company=company, lines=raw_lines)
    for field, value in document_totals(lines).items():
        setattr(invoice, field, value)
    if invoice.total <= 0:
        raise ValidationError("Total strictement positif requis.")
    invoice.balance_due = invoice.total
    if not invoice_id:
        invoice.number = next_document_number(company=company, kind="supplier_invoice", prefix="FINV")
    invoice.save()
    invoice.lines.all().delete()
    SupplierInvoiceLine.objects.bulk_create([SupplierInvoiceLine(invoice=invoice, **line) for line in lines])
    invoice_activity(invoice, membership, "Brouillon enregistré", invoice.number)
    return invoice


@transaction.atomic
def post_supplier_invoice(*, company, membership, invoice_id):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="supplier_invoices.edit")
    invoice = locked_supplier_invoice(company, invoice_id)
    if invoice.status != "draft":
        raise BusinessConflict("La facture est déjà verrouillée.")
    if not invoice.supplier_reference.strip() or invoice.issue_date > timezone.localdate() or invoice.supplier.status != "active":
        raise ValidationError("Référence fournisseur, date effective et fournisseur actif requis.")
    lines = list(invoice.lines.select_for_update(of=("self",)).select_related("product"))
    if not lines or any(l.company_id != company.pk or (l.product_id and l.product.company_id != company.pk) for l in lines):
        raise BusinessConflict("Lignes incohérentes.")
    values = [{f: getattr(l, f) for f in (*LINE_FIELDS, "product_id", "purchase_line_id")} for l in lines]
    validate_purchase_links(company, invoice, values)
    from apps.sales.pricing import line_amounts
    totals = document_totals([line_amounts(v) for v in values])
    if any(getattr(invoice, field) != value for field, value in totals.items()):
        raise BusinessConflict("Totaux incohérents ; vérifier le brouillon.")
    invoice.status, invoice.posted_at = "posted", timezone.now()
    invoice.save(update_fields=["status", "posted_at", "updated_at"])
    invoice_activity(invoice, membership, "Facture comptabilisée", "Lignes et montants figés.")
    return invoice


@transaction.atomic
def bill_purchase_order(*, company, membership, order_id, key):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="supplier_invoices.create")
    order = locked_order(company, order_id)
    identity, fingerprint = request_identity(key, {"order_id": order_id})
    previous = replay(SupplierInvoice.objects.filter(company=company), identity, fingerprint)
    if previous:
        return previous
    if order.status != "confirmed":
        raise BusinessConflict("Commande confirmée requise.")
    lines = []
    for line in order.lines.select_for_update():
        used = line.invoice_lines.filter(company=company).exclude(invoice__status="cancelled").aggregate(value=Sum("quantity"))["value"] or ZERO
        quantity = line.received_quantity - used
        if quantity > 0:
            lines.append({**{f: getattr(line, f) for f in (*LINE_FIELDS, "product_id", "product_name", "description")}, "quantity": quantity, "purchase_line_id": line.pk})
    if not lines:
        raise BusinessConflict("Aucune quantité reçue restant à facturer.")
    today = timezone.localdate()
    invoice = save_supplier_invoice(company=company, membership=membership, key=identity, data=dict(supplier_id=order.supplier_id, order_id=order.pk,
        supplier_reference="", issue_date=today, due_date=today+timedelta(days=30), currency=order.currency, payment_terms="", notes="", lines=lines))
    invoice.request_fingerprint = fingerprint
    invoice.save(update_fields=["request_fingerprint"])
    return invoice
