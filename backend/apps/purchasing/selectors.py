from datetime import timedelta
from decimal import Decimal
from django.db.models import Prefetch, Q
from django.utils import timezone
from rest_framework.exceptions import NotFound
from apps.crm.selectors import salesperson_name
from apps.sales.pricing import ZERO
from .models import Supplier, PurchaseOrder, PurchaseOrderLine, PurchaseActivity, GoodsReceipt, GoodsReceiptLine, SupplierInvoice, SupplierInvoiceLine


def purchase_queryset(company):
    receipts = GoodsReceipt.objects.filter(company=company, supplier__company=company, warehouse__company=company).select_related("warehouse").prefetch_related(
        Prefetch("lines", queryset=GoodsReceiptLine.objects.filter(company=company, order_line__company=company)))
    return PurchaseOrder.objects.filter(company=company, supplier__company=company, buyer__company=company, warehouse__company=company).select_related("supplier", "buyer__user", "warehouse").prefetch_related(
        Prefetch("lines", queryset=PurchaseOrderLine.objects.filter(company=company)),
        Prefetch("receipts", queryset=receipts),
        Prefetch("activities", queryset=PurchaseActivity.objects.filter(company=company)),
        Prefetch("invoices", queryset=SupplierInvoice.objects.filter(company=company, supplier__company=company).prefetch_related(Prefetch("lines", queryset=SupplierInvoiceLine.objects.filter(company=company)))))


def purchase_by_id(company, order_id):
    order = purchase_queryset(company).filter(pk=order_id).first()
    if order is None:
        raise NotFound()
    return order


def receipt_status(order):
    rows = list(order.lines.all())
    return "received" if rows and all(l.received_quantity == l.quantity for l in rows) else "partially_received" if any(l.received_quantity > 0 for l in rows) else "not_received"


def purchase_payload(order, permissions, include_catalog=False):
    state = receipt_status(order)
    invoices = [i for i in order.invoices.all() if i.status != "cancelled"]
    posted = [i for i in invoices if i.status == "posted"]
    billed = sum((i.total for i in posted), ZERO)
    remaining = any(l.received_quantity > sum((il.quantity for i in invoices for il in i.lines.all() if il.purchase_line_id == l.pk), ZERO) for l in order.lines.all())
    visible = "supplier_invoices.view" in permissions
    return dict(id=order.pk, reference=order.number, supplierId=order.supplier_id, supplierName=order.supplier.name,
        date=order.date.isoformat(), expectedDate=order.expected_date.isoformat(), buyer=salesperson_name(order.buyer),
        warehouse=order.warehouse.name, notes=order.notes, currency=order.currency, total=order.total,
        status=order.status, receiptStatus=state, billingStatus="not_billed" if billed == 0 else "billed" if billed >= order.total else "partially_billed", invoiceIds=[i.pk for i in invoices] if visible else [], billedAmount=billed if visible else None, paidAmount=sum((i.amount_paid for i in posted), ZERO) if visible else None,
        documents=[], invoices=[dict(id=i.pk, reference=i.number, total=i.total, paidAmount=i.amount_paid, workflowStatus=i.status) for i in invoices] if visible else [], payments=[], permissions=permissions, asOf=timezone.localdate().isoformat(),
        products=purchase_catalog(order.company) if include_catalog else [],
        stockIntegrated=all(r.stock_applied_at is not None for r in order.receipts.all()),
        lines=[dict(id=str(l.pk), productId=l.product_id, productName=l.product_name, description=l.description,
            quantity=l.quantity, receivedQuantity=l.received_quantity, remainingQuantity=l.quantity-l.received_quantity,
            unitPrice=l.unit_price, discountRate=l.discount_rate, taxRate=l.tax_rate, previousPrice=None, averagePrice=None) for l in order.lines.all()],
        receipts=[dict(id=r.pk, reference=r.number, date=r.date.isoformat(), warehouse=r.warehouse.name,
            lines=[dict(lineId=str(l.order_line_id), quantity=l.quantity) for l in r.lines.all()]) for r in order.receipts.all()],
        activities=[dict(id=str(a.pk), date=a.created_at.isoformat(), title=a.title, detail=a.detail) for a in order.activities.all()],
        capabilities=dict(canEdit=order.status == "draft" and "purchases.edit" in permissions,
            canSend=order.status == "draft" and "purchases.edit" in permissions,
            canConfirm=order.status in {"draft", "sent"} and "purchases.confirm" in permissions,
            canCancel=order.status != "cancelled" and state == "not_received" and "purchases.edit" in permissions,
            canReceive=order.status == "confirmed" and state != "received" and "receipts.create" in permissions, canBill=order.status == "confirmed" and remaining and "supplier_invoices.create" in permissions))


def supplier_queryset(company):
    return Supplier.objects.filter(company=company, buyer__company=company).select_related("buyer__user").prefetch_related(
        Prefetch("orders", queryset=purchase_queryset(company)), Prefetch("invoices", queryset=SupplierInvoice.objects.filter(company=company, supplier__company=company)))


def supplier_by_id(company, supplier_id):
    supplier = supplier_queryset(company).filter(pk=supplier_id).first()
    if supplier is None:
        raise NotFound()
    return supplier


def supplier_metrics(supplier, permissions):
    orders = [o for o in supplier.orders.all() if o.status == "confirmed"]
    completed = [(o, max(r.date for r in o.receipts.all())) for o in orders if receipt_status(o) == "received" and list(o.receipts.all())]
    readable = "purchases.view" in permissions
    count = Decimal(len(completed))
    history = supplier_price_history(supplier)["points"] if readable else []
    recent = [p for p in history if p["date"] >= (timezone.localdate() - timedelta(days=183)).isoformat()]
    return dict(purchaseVolume=sum((o.total for o in orders), ZERO) if readable else None, outstandingBalance=sum((i.balance_due for i in supplier.invoices.all() if i.status == "posted"), ZERO) if "supplier_invoices.view" in permissions else None,
        averageLeadTimeDays=(sum((Decimal((date-o.date).days) for o, date in completed), ZERO) / count).quantize(Decimal("0.1")) if count and readable else None,
        onTimeDelivery=(Decimal(sum(date <= o.expected_date for o, date in completed)) * 100 / count).quantize(Decimal("0.1")) if count and readable else None,
        priceChange=((recent[-1]["price"] / recent[0]["price"] - 1) * 100).quantize(Decimal("0.1")) if len(recent) > 1 and recent[0]["price"] else None,
        score=None)


def supplier_price_history(supplier):
    orders = sorted((o for o in supplier.orders.all() if o.status == "confirmed"), key=lambda o: (o.date, o.pk))
    rows = [(o, l) for o in orders for l in o.lines.all()]
    product = rows[-1][1].product_name if rows else ""
    product_id = rows[-1][1].product_id if rows else None
    points = [dict(date=o.date.isoformat(), price=l.unit_price) for o, l in rows if (l.product_id == product_id if product_id else l.product_id is None and l.product_name == product)]
    return dict(product=product, points=points, source="Prix unitaires HT avant remise des commandes confirmées, même produit ; aucune prévision.")


def supplier_payload(supplier, permissions):
    metrics = supplier_metrics(supplier, permissions)
    orders = [o for o in supplier.orders.all() if o.status == "confirmed"]
    return dict(id=supplier.pk, reference=supplier.reference, name=supplier.name, contact=supplier.contact,
        email=supplier.email, phone=supplier.phone, category=supplier.category, country=supplier.country, city=supplier.city,
        buyer=salesperson_name(supplier.buyer), purchaseVolume=metrics["purchaseVolume"], outstandingBalance=metrics["outstandingBalance"],
        averageLeadTimeDays=metrics["averageLeadTimeDays"], score=None, scoreSource="Non évalué : aucun moteur de score connecté", risk=None,
        status=supplier.status, createdAt=supplier.created_at.date().isoformat(), strategic=supplier.strategic,
        lastPurchaseAt=max(o.date for o in orders).isoformat() if orders and "purchases.view" in permissions else None,
        capabilities=dict(canEdit="suppliers.edit" in permissions, canArchive="suppliers.edit" in permissions and supplier.status != "archived"))


def supplier_detail(supplier, permissions):
    from apps.finance.selectors import payment_queryset, payment_payload
    from .invoice_selectors import invoice_queryset, invoice_payload
    invoices = [invoice_payload(i, permissions) for i in invoice_queryset(supplier.company).filter(supplier=supplier)] if "supplier_invoices.view" in permissions else []
    orders = [purchase_payload(o, permissions) for o in supplier.orders.all()] if "purchases.view" in permissions else []
    payments = [payment_payload(p, permissions) for p in payment_queryset(supplier.company).filter(supplier=supplier)] if "payments.view" in permissions else []
    return dict(**supplier_payload(supplier, permissions), permissions=permissions, asOf=timezone.localdate().isoformat(),
        orders=orders, invoices=invoices, payments=payments, documents=[], contracts=[],
        activities=[dict(id=f"supplier-{supplier.pk}", date=supplier.created_at.isoformat(), title="Fournisseur créé", detail=supplier.reference)] + [a for o in orders for a in o["activities"]])


def filter_suppliers(query, filters, permissions):
    if filters.get("search"):
        term = filters["search"]
        query = query.filter(Q(name__icontains=term) | Q(reference__icontains=term) | Q(contact__icontains=term) | Q(email__icontains=term) | Q(phone__icontains=term) | Q(city__icontains=term))
    for field in ("category", "country", "city", "status"):
        if filters.get(field):
            query = query.filter(**{field: filters[field]})
    if filters.get("strategic"):
        query = query.filter(strategic=True)
    if filters.get("risk") or filters.get("quick") == "risk":
        return []  # Unknown risk/balance never masquerades as a measured zero.
    if filters.get("quick") == "active":
        query = query.filter(status="active")
    if filters.get("quick") == "new":
        query = query.filter(created_at__date__gte=timezone.localdate() - timedelta(days=30))
    rows = [supplier_payload(s, permissions) for s in query]
    if filters.get("quick") == "balance":
        rows = [s for s in rows if s["outstandingBalance"] is not None and s["outstandingBalance"] > 0]
    if filters.get("buyer"):
        rows = [s for s in rows if s["buyer"] == filters["buyer"]]
    if filters.get("quick") == "delay":
        rows = [s for s in rows if s["averageLeadTimeDays"] is not None and s["averageLeadTimeDays"] > 30]
    return sorted(rows, key=lambda s: (-(s["purchaseVolume"] or ZERO), s["name"], s["id"]) if filters.get("sort") == "purchase_desc" else (s["name"], s["id"]))


def supplier_summary(rows):
    delays = [s["averageLeadTimeDays"] for s in rows if s["averageLeadTimeDays"] is not None]
    return dict(active=sum(s["status"] == "active" for s in rows),
        purchaseVolume=sum((s["purchaseVolume"] for s in rows), ZERO) if all(s["purchaseVolume"] is not None for s in rows) else None,
        outstandingBalance=sum((s["outstandingBalance"] for s in rows), ZERO) if all(s["outstandingBalance"] is not None for s in rows) else None, averageLeadTimeDays=sum(delays, ZERO) / Decimal(len(delays)) if delays else None, atRisk=None)


def purchase_catalog(company):
    from apps.inventory.models import Product
    return [dict(id=p.pk, name=p.name, sku=p.reference, purchasePrice=p.purchase_price, taxRate=p.tax_rate, description=p.description) for p in Product.objects.filter(company=company, is_active=True).order_by("name", "pk")]
