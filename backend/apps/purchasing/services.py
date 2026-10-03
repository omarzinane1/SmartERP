from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError
from apps.accounts.services import require_actor
from apps.companies.models import Company
from apps.companies.sequences import next_document_number
from apps.companies.settings_selectors import settings_records
from apps.inventory.models import Warehouse
from apps.sales.services import prepare_lines, resolve_salesperson
from apps.sales.pricing import document_totals, line_amounts
from apps.sales.order_services import LINE_FIELDS, TOTAL_FIELDS
from common.exceptions import BusinessConflict
from common.idempotency import request_identity, replay
from .models import Supplier, PurchaseOrder, PurchaseOrderLine, PurchaseActivity, GoodsReceipt, GoodsReceiptLine


@transaction.atomic
def save_supplier(*, company, membership, data, supplier_id=None):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="suppliers.edit" if supplier_id else "suppliers.create")
    supplier = Supplier.objects.select_for_update().filter(company=company, buyer__company=company, pk=supplier_id).first() if supplier_id else Supplier(company=company)
    if supplier is None:
        raise NotFound()
    values = dict(data)
    if "buyer" in values:
        supplier.buyer = resolve_salesperson(company=company, name=values.pop("buyer"))
    for field, value in values.items():
        setattr(supplier, field, value)
    if supplier_id is None:
        supplier.reference = next_document_number(company=company, kind="supplier", prefix="SUP", dated=False)
    supplier.save()
    return supplier


def resolve_warehouse(company, name):
    matches = list(Warehouse.objects.filter(company=company, is_active=True, name=name)[:2])
    if len(matches) != 1:
        raise ValidationError({"warehouse": ["Choisissez le nom exact d'un dépôt actif de cette société."]})
    return matches[0]


def locked_order(company, order_id):
    order = PurchaseOrder.objects.select_for_update().filter(company=company, pk=order_id,
        supplier__company=company, buyer__company=company, warehouse__company=company).first()
    if order is None:
        raise NotFound()
    return order


def activity(order, membership, title, detail):
    PurchaseActivity.objects.create(company_id=order.company_id, order=order, actor_id=membership.user_id, title=title, detail=detail)


@transaction.atomic
def save_purchase_order(*, company, membership, data, order_id=None):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="purchases.edit" if order_id else "purchases.create")
    order = locked_order(company, order_id) if order_id else PurchaseOrder(company=company, created_by_id=membership.user_id, currency=company.currency)
    if order.status != "draft":
        raise BusinessConflict("Seul un brouillon est modifiable. Les commandes envoyées ou confirmées sont figées.")
    values = dict(data)
    if "supplier_id" in values:
        supplier = Supplier.objects.filter(company=company, buyer__company=company, pk=values.pop("supplier_id")).first()
        if supplier is None:
            raise NotFound("Fournisseur introuvable.")
        if supplier.status != "active":
            raise ValidationError("Fournisseur non actif.")
        order.supplier = supplier
    if "buyer" in values:
        order.buyer = resolve_salesperson(company=company, name=values.pop("buyer"))
    if "warehouse" in values:
        order.warehouse = resolve_warehouse(company, values.pop("warehouse"))
    lines = prepare_lines(company=company, lines=values.pop("lines")) if "lines" in values else None
    for field, value in values.items():
        setattr(order, field, value)
    if order.expected_date < order.date:
        raise ValidationError({"expected_date": ["La livraison attendue doit suivre la commande."]})
    if order.currency != "MAD" or order.currency != company.currency:
        raise ValidationError("Devise de commande non prise en charge.")
    if lines is not None:
        for field, value in document_totals(lines).items():
            setattr(order, field, value)
    if order.total <= 0:
        raise ValidationError("Une commande doit avoir un total positif.")
    if order_id is None:
        order.number = next_document_number(company=company, kind="purchase_order", prefix=settings_records(company)["invoices"].purchase_order_prefix)
    order.save()
    if lines is not None:
        order.lines.all().delete()
        PurchaseOrderLine.objects.bulk_create([PurchaseOrderLine(order=order, **line) for line in lines])
    activity(order, membership, "Commande modifiée" if order_id else "Commande créée", "Brouillon enregistré.")
    return order


@transaction.atomic
def transition_purchase_order(*, company, membership, order_id, action):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="purchases.confirm" if action == "confirm" else "purchases.edit")
    order = locked_order(company, order_id)
    allowed = {"send": {"draft"}, "confirm": {"draft", "sent"}, "cancel": {"draft", "sent", "confirmed"}}
    if action not in allowed or order.status not in allowed[action]:
        raise BusinessConflict("Transition de commande fournisseur invalide.")
    if action == "cancel":
        if order.receipts.exists():
            raise BusinessConflict("Une commande réceptionnée ne peut pas être annulée ; les retours restent hors périmètre.")
    else:
        if order.supplier.status != "active" or not order.warehouse.is_active:
            raise BusinessConflict("Fournisseur ou dépôt non actif.")
        lines = list(order.lines.select_for_update(of=("self",)).select_related("product"))
        if not lines or any(l.company_id != company.pk or (l.product_id and l.product.company_id != company.pk) for l in lines):
            raise BusinessConflict("Lignes de commande incohérentes.")
        recalculated = [line_amounts({f: getattr(l, f) for f in LINE_FIELDS}) for l in lines]
        totals = document_totals(recalculated)
        if any(getattr(order, f) != totals[f] for f in TOTAL_FIELDS):
            raise BusinessConflict("Les totaux doivent être revérifiés dans le brouillon.")
    order.status = {"send": "sent", "confirm": "confirmed", "cancel": "cancelled"}[action]
    field = {"send": "sent_at", "confirm": "confirmed_at", "cancel": "cancelled_at"}[action]
    setattr(order, field, timezone.now())
    order.save(update_fields=["status", field, "updated_at"])
    title, detail = {"send": ("Envoi externe enregistré", "Envoi au fournisseur attesté par l'utilisateur ; aucun e-mail automatique."),
                     "confirm": ("Commande confirmée", "Montants et lignes figés."), "cancel": ("Commande annulée", "Document conservé dans l'historique.")}[action]
    activity(order, membership, title, detail)
    return order


@transaction.atomic
def receive_purchase_order(*, company, membership, order_id, data, key):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="receipts.create")
    order = locked_order(company, order_id)
    key, fingerprint = request_identity(key, {"order": order_id, **data})
    previous = replay(GoodsReceipt.objects.filter(company=company), key, fingerprint)
    if previous:
        return previous
    if order.status != "confirmed":
        raise BusinessConflict("Seule une commande confirmée peut être réceptionnée.")
    if data["date"] < order.date or data["date"] > timezone.localdate():
        raise ValidationError({"date": ["Date de réception invalide."]})
    warehouse = resolve_warehouse(company, data["warehouse"])
    lines = {l.pk: l for l in order.lines.select_for_update()}
    selected = []
    seen = set()
    for item in data["lines"]:
        pk, quantity = item["line_id"], item["quantity"]
        if pk not in lines or lines[pk].company_id != company.pk:
            raise NotFound("Ligne de commande introuvable.")
        if pk in seen:
            raise ValidationError("Ligne de réception dupliquée.")
        seen.add(pk)
        line = lines[pk]
        if quantity <= 0:
            raise ValidationError("Quantité de réception strictement positive requise.")
        if quantity > line.quantity - line.received_quantity:
            raise BusinessConflict("Quantité supérieure au restant à réceptionner.")
        selected.append((line, quantity))
    if not selected:
        raise ValidationError("Au moins une ligne est requise.")
    receipt = GoodsReceipt.objects.create(company=company, order=order, supplier=order.supplier, warehouse=warehouse,
        date=data["date"], number=next_document_number(company=company, kind="goods_receipt", prefix="REC"),
        created_by_id=membership.user_id, operation_key=key, request_fingerprint=fingerprint)
    for line, quantity in selected:
        GoodsReceiptLine.objects.create(company=company, receipt=receipt, order_line=line, quantity=quantity)
        line.received_quantity += quantity
        line.save(update_fields=["received_quantity"])
    from apps.inventory.stock import apply_receipt_stock
    apply_receipt_stock(company=company, membership=membership, receipt=receipt)
    activity(order, membership, "Réception enregistrée", f"{receipt.number} ; quantités reçues et stock des produits liés mis à jour.")
    return receipt
