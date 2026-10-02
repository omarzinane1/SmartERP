from django.db.models import Prefetch, Q
from django.utils import timezone
from rest_framework.exceptions import NotFound
from apps.accounts.selectors import get_effective_permission_codes
from apps.crm.selectors import company_salespeople, salesperson_name
from .models import Invoice, SalesOrder, SalesOrderActivity, SalesOrderLine


def order_queryset(company):
    return SalesOrder.objects.filter(company=company, customer__company=company, salesperson__company=company).filter(Q(quote__isnull=True) | Q(quote__company=company)).select_related("customer", "salesperson__user", "quote")


def order_by_id(*, company, order_id):
    order = order_queryset(company).prefetch_related(
        Prefetch("lines", queryset=SalesOrderLine.objects.filter(company=company).select_related("product")),
        Prefetch("activities", queryset=SalesOrderActivity.objects.filter(company=company).select_related("actor")),
    ).filter(pk=order_id).first()
    if order is None:
        raise NotFound()
    return order


def order_payload(order):
    return dict(id=order.pk, reference=order.number, customerId=order.customer_id, customerName=order.customer.name,
                salesperson=salesperson_name(order.salesperson), createdAt=order.created_at.isoformat(), totalAmount=order.total,
                orderStatus=order.status, deliveryStatus="none", paymentStatus="unpaid")


def money_totals(document):
    return dict(gross=document.gross_total, discount=document.discount_total, net=document.subtotal, tax=document.tax_total, total=document.total)


def order_detail(*, order, membership):
    permissions = get_effective_permission_codes(membership=membership)
    invoices = list(Invoice.objects.filter(company=membership.company, sales_order=order).order_by("issue_date", "pk"))
    active_invoice = any(i.status != "cancelled" for i in invoices)
    invoiced = sum((i.total for i in invoices if i.status == "posted"), 0)
    can_invoice = order.status in {"confirmed", "processing"} and not active_invoice and "invoices.create" in permissions
    return {**order_payload(order), "confirmedAt": order.confirmed_at, "quoteId": order.quote_id,
            "quoteReference": order.quote.number if order.quote_id else None, "customerReference": order.customer_reference,
            "currency": order.currency, "paymentTerms": order.payment_terms,
            "customer": dict(reference=order.customer.reference, contactName=order.customer.name, phone=order.customer.phone, email=order.customer.email,
                             billingAddress=order.billing_address, deliveryAddress=order.delivery_address),
            "lines": [dict(id=line.pk, productId=line.product_id, productReference=line.product.reference if line.product_id else "",
                           productName=line.product_name, description=line.description, quantity=line.quantity, unitPrice=line.unit_price,
                           discountRate=line.discount_rate, taxRate=line.tax_rate, totalExcludingTax=line.subtotal, deliveredQuantity=0, unitCost=None) for line in order.lines.all()],
            "totals": money_totals(order), "invoiceStatus": "invoiced" if invoiced >= order.total and invoiced > 0 else "partial" if invoiced else "none",
            "deliveries": [], "invoices": [dict(id=i.pk, reference=i.number, date=i.issue_date.isoformat(), dueDate=i.due_date.isoformat(), amount=i.total, status=i.status) for i in invoices] if "invoices.view" in permissions else [], "payments": [], "documents": [],
            "activities": [dict(id=str(a.pk), type=a.type, description=a.description, date=a.created_at.isoformat(), user=a.actor.get_full_name() or a.actor.email if a.actor else "") for a in order.activities.all()],
            "permissions": permissions, "capabilities": dict(canConfirm=order.status == "draft" and "sales.edit" in permissions,
                                                              canCancel=order.status in {"draft", "confirmed"} and not active_invoice and "sales.edit" in permissions,
                                                              canDeliver=False, canInvoice=can_invoice, invoiceableAmount=order.total if can_invoice else 0,
                                                              invoiceMode="full_order"),
            "warehouses": [], "asOf": timezone.localdate().isoformat()}


def filter_orders(query, filters, *, company):
    if filters.get("search"):
        query = query.filter(Q(number__icontains=filters["search"]) | Q(customer__name__icontains=filters["search"]))
    if filters.get("status"):
        query = query.filter(status=filters["status"])
    if filters.get("customer"):
        query = query.filter(customer_id=filters["customer"])
    if filters.get("salesperson"):
        query = query.filter(salesperson_id__in=[m.pk for m in company_salespeople(company) if salesperson_name(m) == filters["salesperson"]])
    if filters.get("delivery_status", "none") != "none" or filters.get("payment_status", "unpaid") != "unpaid":
        query = query.none()  # No delivery/payment engine exists in this milestone.
    return query.order_by(filters.get("ordering", "-created_at"), "pk")
