from collections import defaultdict
from datetime import timedelta
from decimal import Decimal
from django.db.models import Count, Max, Prefetch, Q, Sum, F, OuterRef, Subquery, DecimalField, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework.exceptions import NotFound
from .models import Product, Warehouse, StockLevel, StockMovement, StockTransfer, StockTransferLine, StockTransferActivity, ProductPriceRecord
from .valuation import ZERO, quantize_value, assert_supported_valuation


def product_queryset(company):
    return Product.objects.filter(company=company).filter(Q(category__isnull=True) | Q(category__company=company)).filter(Q(unit__isnull=True) | Q(unit__company=company)).filter(Q(supplier__isnull=True) | Q(supplier__company=company)).select_related("category", "unit", "supplier").order_by("name", "pk")


def stock_context(company):
    products = list(product_queryset(company))
    warehouses = list(Warehouse.objects.filter(company=company).order_by("name", "pk"))
    levels = {(s.product_id, s.warehouse_id): s for s in StockLevel.objects.filter(company=company, product__company=company, warehouse__company=company)}
    latest = {(s["product_id"], s["warehouse_id"]): s["last"] for s in StockMovement.objects.filter(company=company, product__company=company, warehouse__company=company).values("product_id", "warehouse_id").annotate(last=Max("date"))}
    incoming = defaultdict(lambda: ZERO)
    for line in StockTransferLine.objects.filter(company=company, product__company=company, transfer__company=company, transfer__status="in_transit", transfer__destination_warehouse__company=company).select_related("transfer"):
        incoming[(line.product_id, line.transfer.destination_warehouse_id)] += line.quantity
    transfer_counts = dict(StockTransfer.objects.filter(company=company, status="in_transit", destination_warehouse__company=company).values("destination_warehouse_id").annotate(count=Count("pk")).values_list("destination_warehouse_id", "count"))
    return dict(products=products, warehouses=warehouses, levels=levels, latest=latest, incoming=incoming, transfer_counts=transfer_counts)


def health(product, quantity):
    if not product.is_active:
        return "inactive"
    if product.kind == "service":
        return "not_stocked"
    if quantity == 0:
        return "out_of_stock"
    if quantity <= product.minimum_stock:
        return "low_stock"
    if product.maximum_stock and quantity > product.maximum_stock:
        return "overstock"
    return "healthy"


def inventory_rows(context):
    rows = []
    for product in context["products"]:
        if product.kind != "product":
            continue
        for warehouse in context["warehouses"]:
            key = (product.pk, warehouse.pk)
            level = context["levels"].get(key)
            if not warehouse.is_active and not level:
                continue
            quantity, value = (level.quantity_on_hand, level.total_value) if level else (ZERO, ZERO)
            rows.append(dict(productId=product.pk, warehouseId=warehouse.pk, productName=product.name, sku=product.reference,
                warehouseName=warehouse.name, onHand=quantity, reserved=ZERO, available=quantity, incoming=context["incoming"][key],
                lastMovementAt=context["latest"][key].isoformat() if key in context["latest"] else None,
                value=value, minimum=product.minimum_stock, health=health(product, quantity), unit=product.unit.name if product.unit_id else "unit"))
    return rows


def product_payload(product, permissions, context):
    tracked = product.kind == "product" and "inventory.view" in permissions
    levels = [s for (pid, _), s in context["levels"].items() if pid == product.pk]
    quantity = sum((s.quantity_on_hand for s in levels), ZERO)
    value = sum((s.total_value for s in levels), ZERO)
    incoming = sum((v for (pid, _), v in context["incoming"].items() if pid == product.pk), ZERO)
    return dict(id=product.pk, name=product.name, sku=product.reference, type=product.kind,
        category=product.category.name if product.category_id else "", unit=product.unit.name if product.unit_id else "unit",
        supplierId=product.supplier_id, supplierName=product.supplier.name if product.supplier_id else "",
        purchasePrice=product.purchase_price, sellingPrice=product.unit_price, taxRate=product.tax_rate,
        barcode=product.barcode, minimumStock=product.minimum_stock, maximumStock=product.maximum_stock, description=product.description,
        status="active" if product.is_active else "archived", averageCost=quantize_value(value/quantity) if tracked and quantity else ZERO,
        onHand=quantity if tracked else None, reserved=ZERO if tracked else None, available=quantity if tracked else None,
        incoming=incoming if tracked else None, stockValue=value if tracked else None, stockHealth=health(product, quantity) if tracked else "not_stocked",
        capabilities=dict(canEdit="products.edit" in permissions, canArchive="products.edit" in permissions and product.is_active and quantity == 0))


def catalog_payloads(context, permissions):
    return [product_payload(p, permissions, context) for p in context["products"]]


def get_low_stock_products(*, company, context=None):
    context = context or stock_context(company)
    active_warehouses = {w.pk for w in context["warehouses"] if w.is_active}
    return [r for r in inventory_rows(context) if r["warehouseId"] in active_warehouses and r["health"] in {"low_stock", "out_of_stock"}]


def low_stock_queryset(company, warehouse):
    """SQL equivalent of get_low_stock_products for one active warehouse.

    Reservations are not implemented: available = on hand. Missing rows mean zero.
    """
    if warehouse is None or warehouse.company_id != company.pk or not warehouse.is_active:
        return Product.objects.none()
    level = StockLevel.objects.filter(company=company, warehouse=warehouse, warehouse__company=company, product_id=OuterRef("pk"))
    quantity = DecimalField(max_digits=18, decimal_places=3)
    return product_queryset(company).filter(is_active=True, kind="product").annotate(
        available_stock=Coalesce(Subquery(level.values("quantity_on_hand")[:1]), Value(ZERO), output_field=quantity)
    ).filter(available_stock__lte=F("minimum_stock"))


def warehouse_payload(warehouse, context, permissions):
    visible = "inventory.view" in permissions
    rows = [r for r in inventory_rows(context) if r["warehouseId"] == warehouse.pk]
    quantity = sum((r["onHand"] for r in rows), ZERO)
    # Capacity is expressed in pieces. No kg/L/box conversions are invented.
    comparable = all(r["unit"] in {"unit", "unité", "unités", "pièce", "pièces"} for r in rows if r["onHand"])
    return dict(id=warehouse.pk, reference=warehouse.code, name=warehouse.name, city=warehouse.city, country=warehouse.country,
        manager=warehouse.manager, capacity=warehouse.capacity, capacityUnit=warehouse.capacity_unit, status="active" if warehouse.is_active else "inactive",
        stockValue=sum((r["value"] for r in rows), ZERO) if visible else None, products=sum(r["onHand"] > 0 for r in rows) if visible else None,
        lowStock=sum(r["health"] == "low_stock" for r in rows) if visible else None, outOfStock=sum(r["health"] == "out_of_stock" for r in rows) if visible else None,
        usedCapacity=quantity if visible and comparable else None,
        capacityPercent=quantize_value(quantity/Decimal(warehouse.capacity)*100) if visible and comparable and warehouse.capacity else None,
        incomingTransfers=context["transfer_counts"].get(warehouse.pk, 0) if "inventory.transfers.view" in permissions else None)


def movement_queryset(company):
    return StockMovement.objects.filter(company=company, product__company=company, warehouse__company=company).select_related("product", "warehouse", "created_by", "receipt_line__receipt", "transfer_line__transfer__destination_warehouse")


MOVEMENT_TYPES = {"receipt": "in", "issue": "out", "return": "return", "adjustment_in": "adjustment", "adjustment_out": "adjustment", "transfer_in": "transfer", "transfer_out": "transfer"}


def movement_payload(movement, permissions):
    transfer = movement.transfer_line.transfer if movement.transfer_line_id else None
    receipt = movement.receipt_line.receipt if movement.receipt_line_id else None
    return dict(id=movement.pk, reference=movement.number, date=movement.date.isoformat(), type=MOVEMENT_TYPES[movement.movement_type],
        productId=movement.product_id, productName=movement.product.name, warehouseId=movement.warehouse_id, warehouseName=movement.warehouse.name,
        destinationId=transfer.destination_warehouse_id if transfer else None, destinationName=transfer.destination_warehouse.name if transfer else None,
        quantity=movement.quantity, before=movement.quantity_before, after=movement.quantity_after, unitCost=movement.unit_cost,
        valueBefore=movement.value_before, valueAfter=movement.value_after, valueDelta=movement.value_delta,
        sourceReference=movement.source_reference,
        sourcePath=f"/purchases/{receipt.order_id}" if receipt and "purchases.view" in permissions else None,
        user=movement.created_by.get_full_name() or movement.created_by.email, note=movement.note)


def transfer_queryset(company):
    return StockTransfer.objects.filter(company=company, source_warehouse__company=company, destination_warehouse__company=company).select_related("source_warehouse", "destination_warehouse", "created_by").prefetch_related(
        Prefetch("lines", queryset=StockTransferLine.objects.filter(company=company, product__company=company)),
        Prefetch("activities", queryset=StockTransferActivity.objects.filter(company=company)))


def transfer_payload(transfer, permissions):
    approve = "inventory.transfers.approve" in permissions
    return dict(id=transfer.pk, reference=transfer.number, sourceId=transfer.source_warehouse_id, destinationId=transfer.destination_warehouse_id,
        sourceName=transfer.source_warehouse.name, destinationName=transfer.destination_warehouse.name, date=transfer.date.isoformat(),
        status=transfer.status, referenceExternal=transfer.reference_external, notes=transfer.notes,
        user=transfer.created_by.get_full_name() or transfer.created_by.email,
        lines=[dict(productId=l.product_id, quantity=l.quantity) for l in transfer.lines.all()],
        activities=[dict(id=str(a.pk), date=a.created_at.isoformat(), title=a.title, detail=a.detail) for a in transfer.activities.all()],
        capabilities=dict(canEdit=transfer.status == "draft" and "inventory.transfers.create" in permissions,
            canReady=transfer.status == "draft" and approve, canStart=transfer.status == "ready" and approve,
            canComplete=transfer.status == "in_transit" and approve, canCancel=transfer.status in {"draft", "ready", "in_transit"} and approve))


def inventory_summary(company, permissions, context=None):
    assert_supported_valuation(company)
    context = context or stock_context(company)
    rows = inventory_rows(context)
    cutoff = (timezone.localdate()-timedelta(days=90)).isoformat()
    return dict(value=sum((s.total_value for s in context["levels"].values()), ZERO), available=sum((r["available"] for r in rows), ZERO),
        lowStock=sum(p["stockHealth"] == "low_stock" for p in catalog_payloads(context, permissions)), outOfStock=sum(p["stockHealth"] == "out_of_stock" for p in catalog_payloads(context, permissions)),
        dormantValue=sum((r["value"] for r in rows if r["lastMovementAt"] and r["lastMovementAt"] < cutoff), ZERO),
        incoming=sum((r["incoming"] for r in rows), ZERO), permissions=permissions, asOf=timezone.localdate().isoformat(),
        products=catalog_payloads(context, permissions), rows=rows, warehouses=[warehouse_payload(w, context, permissions) for w in context["warehouses"]],
        valuationMethod="weighted_average", quantityUnit="Quantités agrégées sans conversion d'unités", reservationPolicy="none")


def warehouse_valuation(company, warehouse, context):
    assert_supported_valuation(company)
    rows = [r for r in inventory_rows(context) if r["warehouseId"] == warehouse.pk]
    running, history = ZERO, []
    for day in StockMovement.objects.filter(company=company, warehouse=warehouse).values("date").annotate(delta=Sum("value_delta")).order_by("date"):
        running += day["delta"]
        history.append(dict(date=day["date"].isoformat(), value=running))
    return dict(byProduct=[dict(name=r["productName"], value=r["value"]) for r in rows if r["onHand"]], history=history,
        source="Ledger réel, coût moyen pondéré par dépôt ; montants HT, aucune prévision.")


def product_history(company, product, permissions):
    prices = [dict(date=p.created_at.date().isoformat(), purchase=p.purchase_price, selling=p.selling_price) for p in ProductPriceRecord.objects.filter(company=company, product=product)]
    running, history = ZERO, []
    if "inventory.view" in permissions:
        for day in StockMovement.objects.filter(company=company, product=product).values("date").annotate(delta=Sum("quantity")).order_by("date"):
            running += day["delta"]
            history.append(dict(date=day["date"].isoformat(), available=running))
    return dict(stock=history, prices=prices, source="Mouvements et changements de prix enregistrés ; aucun historique synthétique.")


def product_documents(company, product, permissions):
    from apps.sales.models import InvoiceLine
    from apps.purchasing.models import PurchaseOrderLine
    sales = [dict(id=l.invoice_id, reference=l.invoice.number, date=l.invoice.issue_date.isoformat(), quantity=l.quantity, net=l.subtotal) for l in InvoiceLine.objects.filter(company=company, product=product, invoice__company=company, invoice__status="posted").select_related("invoice")] if "invoices.view" in permissions else []
    purchases = [dict(id=l.order_id, reference=l.order.number, date=l.order.date.isoformat(), quantity=l.quantity, unitPrice=l.unit_price) for l in PurchaseOrderLine.objects.filter(company=company, product=product, order__company=company, order__status="confirmed").select_related("order")] if "purchases.view" in permissions else []
    return sales, purchases
