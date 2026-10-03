from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from apps.accounts.services import require_actor
from apps.companies.models import Company
from apps.companies.sequences import next_document_number
from common.exceptions import BusinessConflict
from common.idempotency import request_identity, replay
from .models import Product, Warehouse, StockLevel, StockMovement
from .services import scoped
from .valuation import assert_supported_valuation, quantize_value, ZERO


def _record_movement(*, company, membership, product, warehouse, quantity, movement_type, date, key,
                     fingerprint, unit_cost=None, exact_value=None, receipt_line=None, transfer_line=None,
                     source_reference="", note=""):
    """Private ledger writer. Caller holds the Company lock in an atomic service.

    Company lock protects the first StockLevel insert; row lock protects existing
    projections. All application stock writes, including receipts/transfers, pass here.
    """
    assert_supported_valuation(company)
    if product.company_id != company.pk or warehouse.company_id != company.pk:
        from rest_framework.exceptions import NotFound
        raise NotFound()
    if product.kind != "product" or not product.is_active or not warehouse.is_active:
        raise BusinessConflict("Produit stockable et dépôt actifs requis.")
    if not isinstance(quantity, Decimal) or not quantity.is_finite() or quantity == 0 or quantity.as_tuple().exponent < -3:
        raise ValidationError("Quantité Decimal non nulle, trois décimales maximum.")
    incoming = movement_type in {"receipt", "adjustment_in", "transfer_in", "return"}
    if movement_type not in StockMovement.TYPES or incoming != (quantity > 0):
        raise ValidationError("Sens du mouvement invalide.")
    if date > timezone.localdate():
        raise ValidationError("Un mouvement effectif ne peut être futur.")
    if StockMovement.objects.filter(company=company, product=product, warehouse=warehouse, date__gt=date).exists():
        raise BusinessConflict("Mouvement antérieur au dernier mouvement : utilisez une date effective actuelle.")
    level, _ = StockLevel.objects.get_or_create(company=company, warehouse=warehouse, product=product)
    level = StockLevel.objects.select_for_update().get(pk=level.pk, company=company)
    before, value_before = level.quantity_on_hand, level.total_value
    after = before + quantity
    if after < 0:
        raise BusinessConflict("Stock disponible insuffisant ; le stock négatif est interdit.")
    if incoming:
        cost = product.purchase_price if unit_cost is None else unit_cost
        if not isinstance(cost, Decimal) or not cost.is_finite() or cost < 0:
            raise ValidationError("Coût Decimal positif ou nul requis.")
        value_delta = quantize_value(quantity * cost) if exact_value is None else exact_value
        if value_delta < 0:
            raise ValidationError("Valeur entrante invalide.")
    else:
        value_delta = -value_before if after == 0 else -quantize_value(value_before * (-quantity) / before)
    cost = quantize_value(abs(value_delta / quantity))
    movement = StockMovement.objects.create(company=company, product=product, warehouse=warehouse,
        number=next_document_number(company=company, kind="stock_movement", prefix="MOV"), movement_type=movement_type,
        date=date, quantity=quantity, unit_cost=cost, value_delta=value_delta, quantity_before=before, quantity_after=after,
        value_before=value_before, value_after=value_before+value_delta, receipt_line=receipt_line, transfer_line=transfer_line,
        source_reference=source_reference, note=note, created_by_id=membership.user_id, operation_key=key, request_fingerprint=fingerprint)
    level.quantity_on_hand, level.total_value = after, value_before + value_delta
    level.save(update_fields=["quantity_on_hand", "total_value", "updated_at"])
    return movement


@transaction.atomic
def create_stock_movement(*, company, membership, data, key):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="inventory.movements.create")
    key, fingerprint = request_identity(key, data)
    previous = replay(StockMovement.objects.filter(company=company), key, fingerprint)
    if previous:
        return previous
    product = scoped(Product, company, data["product_id"])
    warehouse = scoped(Warehouse, company, data["warehouse_id"])
    kind = {"in": "receipt", "out": "issue", "return": "return", "adjustment": "adjustment_in" if data.get("adjustment_direction") == "increase" else "adjustment_out"}[data["type"]]
    quantity = -data["quantity"] if kind in {"issue", "adjustment_out"} else data["quantity"]
    return _record_movement(company=company, membership=membership, product=product, warehouse=warehouse,
        quantity=quantity, movement_type=kind, date=data["date"], key=key, fingerprint=fingerprint,
        unit_cost=data.get("unit_cost"), source_reference=data.get("source_reference", ""), note=data.get("note", ""))


@transaction.atomic
def apply_receipt_stock(*, company, membership, receipt):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="receipts.create")
    from apps.purchasing.models import GoodsReceipt
    receipt = scoped(GoodsReceipt, company, receipt.pk, True)
    if receipt.stock_applied_at:
        raise BusinessConflict("Cette réception a déjà été appliquée au stock.")
    lines = receipt.lines.filter(company=company, order_line__company=company).select_related("order_line__product")
    for line in lines:
        source = line.order_line
        if source.order_id != receipt.order_id or receipt.warehouse.company_id != company.pk:
            raise BusinessConflict("Réception incohérente.")
        if not source.product_id or source.product.kind == "service":
            continue
        # Cost uses the document's net amount excluding recoverable tax, never
        # the current catalog price. Value precision is maintained in the ledger.
        cost = source.subtotal / source.quantity
        key, fingerprint = request_identity(f"receipt-line:{line.pk}", {"receipt": receipt.pk, "line": line.pk, "quantity": line.quantity})
        _record_movement(company=company, membership=membership, product=source.product, warehouse=receipt.warehouse,
            quantity=line.quantity, movement_type="receipt", date=receipt.date, key=key, fingerprint=fingerprint,
            unit_cost=cost, receipt_line=line, source_reference=receipt.number, note="Réception fournisseur")
    receipt.stock_applied_at = timezone.now()
    receipt.save(update_fields=["stock_applied_at", "updated_at"])
    return receipt
