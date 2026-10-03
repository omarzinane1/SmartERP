from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError, NotFound
from apps.accounts.services import require_actor
from apps.companies.models import Company
from apps.companies.sequences import next_document_number
from common.exceptions import BusinessConflict
from common.idempotency import request_identity, replay
from .models import Product, Warehouse, StockLevel, StockTransfer, StockTransferLine, StockTransferActivity
from .services import scoped
from .stock import _record_movement
from .valuation import ZERO


def locked_transfer(company, pk):
    transfer = scoped(StockTransfer, company, pk, True)
    if transfer.source_warehouse.company_id != company.pk or transfer.destination_warehouse.company_id != company.pk:
        raise NotFound()
    return transfer


def activity(transfer, membership, title, detail):
    StockTransferActivity.objects.create(company_id=transfer.company_id, transfer=transfer, actor_id=membership.user_id, title=title, detail=detail)


def check_available(company, warehouse, lines):
    levels = {s.product_id: s.quantity_on_hand for s in StockLevel.objects.select_for_update().filter(company=company, warehouse=warehouse).order_by("product_id")}
    for line in lines:
        if line["quantity"] > levels.get(line["product_id"], ZERO):
            raise BusinessConflict("Stock disponible insuffisant dans le dépôt source.")


@transaction.atomic
def create_stock_transfer(*, company, membership, data, key=None, transfer_id=None):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="inventory.transfers.create")
    if transfer_id:
        transfer = locked_transfer(company, transfer_id)
        if transfer.status != "draft":
            raise BusinessConflict("Seul un transfert brouillon est modifiable.")
    else:
        key, fingerprint = request_identity(key, data)
        previous = replay(StockTransfer.objects.filter(company=company), key, fingerprint)
        if previous:
            return previous
        transfer = StockTransfer(company=company, created_by_id=membership.user_id, operation_key=key, request_fingerprint=fingerprint)
    values = dict(data)
    for field in ("source_warehouse", "destination_warehouse"):
        if f"{field}_id" in values:
            warehouse = scoped(Warehouse, company, values.pop(f"{field}_id"))
            if not warehouse.is_active:
                raise ValidationError("Dépôt inactif.")
            setattr(transfer, field, warehouse)
    if transfer.source_warehouse_id == transfer.destination_warehouse_id:
        raise ValidationError("Les dépôts source et destination doivent être différents.")
    lines = values.pop("lines", None)
    if lines is None:
        lines = list(transfer.lines.filter(company=company).values("product_id", "quantity"))
    ids = [l["product_id"] for l in lines]
    if not ids or len(ids) != len(set(ids)):
        raise ValidationError("Lignes requises, sans produit dupliqué.")
    products = Product.objects.filter(company=company, pk__in=ids, is_active=True, kind="product")
    if products.count() != len(ids):
        raise NotFound("Produit stockable introuvable.")
    if any(l["quantity"] <= 0 for l in lines):
        raise ValidationError("Quantités positives requises.")
    check_available(company, transfer.source_warehouse, lines)
    for field, value in values.items():
        setattr(transfer, field, value)
    if not transfer_id:
        transfer.number = next_document_number(company=company, kind="stock_transfer", prefix="TRF")
    transfer.save()
    transfer.lines.all().delete()
    StockTransferLine.objects.bulk_create([StockTransferLine(company=company, transfer=transfer, **l) for l in lines])
    activity(transfer, membership, "Brouillon enregistré", "Stock déplacé uniquement à la clôture ; aucune réservation.")
    return transfer


@transaction.atomic
def transition_stock_transfer(*, company, membership, transfer_id, action):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="inventory.transfers.approve")
    transfer = locked_transfer(company, transfer_id)
    allowed = {"ready": {"draft"}, "start": {"ready"}, "complete": {"in_transit"}, "cancel": {"draft", "ready", "in_transit"}}
    if action not in allowed or transfer.status not in allowed[action]:
        raise BusinessConflict("Transition de transfert invalide ou déjà effectuée.")
    lines = list(transfer.lines.select_for_update(of=("self",)).select_related("product").order_by("product_id"))
    if not lines or any(l.company_id != company.pk or l.product.company_id != company.pk for l in lines):
        raise BusinessConflict("Lignes de transfert incohérentes.")
    if action != "cancel":
        if not transfer.source_warehouse.is_active or not transfer.destination_warehouse.is_active or any(not l.product.is_active for l in lines):
            raise BusinessConflict("Produit ou dépôt inactif.")
        check_available(company, transfer.source_warehouse, [dict(product_id=l.product_id, quantity=l.quantity) for l in lines])
    if action == "complete":
        # Completion is the sole physical movement boundary. Use today's actual
        # completion date; transfer.date is the requested/logistical date.
        for line in lines:
            shared = dict(company=company, membership=membership, product=line.product, transfer_line=line,
                date=timezone.localdate(), source_reference=transfer.number, note=transfer.notes)
            key, fingerprint = request_identity(f"transfer-out:{line.pk}", {"transfer": transfer.pk, "line": line.pk})
            outgoing = _record_movement(**shared, warehouse=transfer.source_warehouse, quantity=-line.quantity,
                movement_type="transfer_out", key=key, fingerprint=fingerprint)
            key, fingerprint = request_identity(f"transfer-in:{line.pk}", {"transfer": transfer.pk, "line": line.pk})
            _record_movement(**shared, warehouse=transfer.destination_warehouse, quantity=line.quantity,
                movement_type="transfer_in", key=key, fingerprint=fingerprint, exact_value=-outgoing.value_delta)
        transfer.completed_at = timezone.now()
    transfer.status = {"ready": "ready", "start": "in_transit", "complete": "completed", "cancel": "cancelled"}[action]
    transfer.save(update_fields=["status", "completed_at", "updated_at"])
    activity(transfer, membership, {"ready": "Transfert prêt", "start": "Transport démarré", "complete": "Transfert clôturé", "cancel": "Transfert annulé"}[action],
        "Sortie et entrée enregistrées ensemble." if action == "complete" else "Aucune modification du stock physique.")
    return transfer


def approve_stock_transfer(**kwargs):
    return transition_stock_transfer(**kwargs, action="ready")


def complete_stock_transfer(**kwargs):
    return transition_stock_transfer(**kwargs, action="complete")


def cancel_stock_transfer(**kwargs):
    return transition_stock_transfer(**kwargs, action="cancel")
