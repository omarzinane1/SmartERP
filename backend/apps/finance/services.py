from decimal import Decimal
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError
from apps.accounts.services import require_actor
from apps.companies.models import Company
from apps.companies.sequences import next_document_number
from apps.crm.models import Customer
from apps.purchasing.models import Supplier
from apps.sales.invoice_workflows import locked_invoice, invoice_activity
from apps.sales.models import Invoice
from apps.sales.pricing import ZERO
from common.exceptions import BusinessConflict
from common.idempotency import request_identity, replay
from .models import Payment, PaymentAllocation
from apps.purchasing.models import SupplierInvoice
from apps.purchasing.invoice_services import locked_supplier_invoice, invoice_activity as supplier_activity


def allocation_target(invoice):
    return {"supplier_invoice" if isinstance(invoice, SupplierInvoice) else "invoice": invoice}


def financial_invoice(company, pk, direction):
    return locked_supplier_invoice(company, pk) if direction == "outgoing" else locked_invoice(company, pk)


def payment_activity(invoice, membership, message):
    if isinstance(invoice, SupplierInvoice):
        supplier_activity(invoice, membership, "Paiement", message)
    else:
        invoice_activity(invoice, membership, "payment", message)


def locked_payment(company, payment_id):
    payment = Payment.objects.select_for_update(of=("self",)).filter(company=company, pk=payment_id).filter(
        Q(direction="incoming", customer__company=company) | Q(direction="outgoing", supplier__company=company),
    ).first()
    if payment is None:
        raise NotFound()
    return payment


def recalculate_invoice(invoice):
    invoice.amount_paid = PaymentAllocation.objects.filter(company_id=invoice.company_id, **allocation_target(invoice),
        payment__company_id=invoice.company_id, payment__status="completed", reversed_at__isnull=True).aggregate(value=Sum("amount"))["value"] or ZERO
    invoice.balance_due = invoice.total - getattr(invoice, "credit_total", ZERO) - invoice.amount_paid
    invoice.save(update_fields=["amount_paid", "balance_due", "updated_at"])


def assert_recorded_balance(invoice):
    recorded = PaymentAllocation.objects.filter(company_id=invoice.company_id, **allocation_target(invoice),
        payment__company_id=invoice.company_id, payment__status="completed", reversed_at__isnull=True).aggregate(value=Sum("amount"))["value"] or ZERO
    if invoice.amount_paid != recorded:
        raise BusinessConflict("Le solde historique doit être réconcilié avec les paiements avant cette opération.")


@transaction.atomic
def allocate_payment(*, company, membership, payment_id, invoice_id, amount, key):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="payments.create")
    payment = locked_payment(company, payment_id)
    invoice = financial_invoice(company, invoice_id, payment.direction)
    key, fingerprint = request_identity(key, dict(payment=payment_id, invoice=invoice_id, amount=amount))
    existing = replay(PaymentAllocation.objects.filter(company=company), key, fingerprint)
    if existing:
        return existing
    if not isinstance(amount, Decimal) or not amount.is_finite() or amount <= 0 or amount.as_tuple().exponent < -2:
        raise ValidationError({"amount": ["Montant Decimal positif, deux décimales maximum."]})
    if payment.status != "completed" or invoice.status != "posted":
        raise BusinessConflict("Paiement ou facture non éligible à l'affectation.")
    if (payment.customer_id if payment.direction == "incoming" else payment.supplier_id) != (invoice.customer_id if payment.direction == "incoming" else invoice.supplier_id):
        raise ValidationError("Le paiement et la facture doivent appartenir au même client.")
    if payment.currency != invoice.currency:
        raise ValidationError("Les devises doivent correspondre ; conversion FX indisponible.")
    if payment.date < invoice.issue_date:
        raise ValidationError("La date de paiement précède la facture.")
    assert_recorded_balance(invoice)
    used = payment.allocations.filter(company=company, reversed_at__isnull=True).aggregate(value=Sum("amount"))["value"] or ZERO
    if amount > payment.amount - used or amount > invoice.balance_due:
        raise BusinessConflict("Montant supérieur au paiement disponible ou au solde de la facture.")
    allocation = PaymentAllocation.objects.create(company=company, payment=payment, **allocation_target(invoice), amount=amount,
        operation_key=key, request_fingerprint=fingerprint, created_by_id=membership.user_id)
    recalculate_invoice(invoice)
    payment_activity(invoice, membership, f"Paiement {payment.number} affecté : {amount} {payment.currency}.")
    return allocation


@transaction.atomic
def create_payment(*, company, membership, data, key):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="payments.create")
    key, fingerprint = request_identity(key, data)
    existing = replay(Payment.objects.filter(company=company), key, fingerprint)
    if existing:
        return existing
    values = dict(data)
    partner_id, invoice_id = values.pop("partner_id"), values.pop("invoice_id", None)
    model = Customer if values["direction"] == "incoming" else Supplier
    partner = model.objects.filter(company=company, pk=partner_id).first()
    if partner is None:
        raise NotFound("Tiers introuvable.")
    if partner.status in {"archived", "blocked", "inactive"}:
        raise ValidationError("Tiers non actif.")
    if values["currency"] != company.currency or values["currency"] != "MAD":
        raise ValidationError({"currency": ["Seuls les paiements dans la devise MAD de la société sont pris en charge."]})
    if values["date"] > timezone.localdate():
        raise ValidationError({"date": ["Un paiement enregistré ne peut être futur."]})
    payment = Payment.objects.create(company=company, **values,
        **({"customer": partner} if values["direction"] == "incoming" else {"supplier": partner}),
        number=next_document_number(company=company, kind="payment", prefix="PAY"), created_by_id=membership.user_id,
        operation_key=key, request_fingerprint=fingerprint)
    if invoice_id:
        allocate_payment(company=company, membership=membership, payment_id=payment.pk,
                         invoice_id=invoice_id, amount=payment.amount, key=f"create-payment:{payment.pk}")
    return payment


@transaction.atomic
def cancel_payment(*, company, membership, payment_id):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="payments.cancel")
    payment = locked_payment(company, payment_id)
    if payment.status not in {"pending", "completed"}:
        raise BusinessConflict("Ce paiement ne peut pas être annulé.")
    allocations = list(payment.allocations.select_for_update().filter(company=company, reversed_at__isnull=True))
    invoices = [financial_invoice(company, pk, payment.direction) for pk in sorted({a.invoice_id if payment.direction == "incoming" else a.supplier_invoice_id for a in allocations})]
    for invoice in invoices:
        assert_recorded_balance(invoice)
    now = timezone.now()
    payment.status, payment.cancelled_at, payment.cancelled_by_id = "cancelled", now, membership.user_id
    payment.save(update_fields=["status", "cancelled_at", "cancelled_by", "updated_at"])
    payment.allocations.filter(company=company, reversed_at__isnull=True).update(reversed_at=now)
    for invoice in invoices:
        recalculate_invoice(invoice)
        payment_activity(invoice, membership, f"Paiement {payment.number} annulé ; affectations contrepassées.")
    return payment
