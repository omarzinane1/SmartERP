"""Executive dashboard: persisted ledgers, bounded SQL aggregates, no AI estimates."""
from calendar import monthrange
from datetime import date, timedelta
from zoneinfo import ZoneInfo
from django.db.models import Count, F, Max, OuterRef, Q, Subquery, Sum
from django.db.models.functions import TruncDate, TruncMonth
from django.utils import timezone
from apps.crm.models import Customer
from apps.sales.models import CreditNote, CreditNoteLine, InvoiceLine, SalesOrder
from apps.inventory.models import Product, StockLevel, StockMovement
from apps.finance.summary_selectors import ZERO, amount, eligible_invoices, balance_summary, aging_buckets, get_expenses_summary, get_cash_flow_summary, get_cash_flow_series
from common.dates import company_today
from .analytics import summed_subquery


def credits(company):
    return CreditNote.objects.filter(company=company, status="posted", currency=company.currency, customer__company=company, original_invoice__company=company)


def monthly(query, field, start, end, measure):
    return {row["month"].month: row["value"] for row in query.filter(**{f"{field}__range": (start, end)}).order_by().annotate(month=TruncMonth(field)).values("month").annotate(value=measure)}


def sales_kpis(company, start, end, permissions):
    if "invoices.view" not in permissions:
        return dict(revenue=None, count=None, orders=None, series=[])
    invoice_query = eligible_invoices(company)
    credit_query = credits(company)
    totals = invoice_query.filter(issue_date__range=(start, end)).aggregate(amount=Sum("subtotal", default=ZERO), count=Count("pk"))
    net = totals["amount"]-amount(credit_query.filter(date__range=(start, end)), "subtotal")
    previous_end = date(end.year-1, end.month, min(end.day, monthrange(end.year-1, end.month)[1]))
    orders = SalesOrder.objects.filter(company=company, customer__company=company, currency=company.currency, status__in=["confirmed", "processing", "completed"]).annotate(day=TruncDate("confirmed_at", tzinfo=ZoneInfo(company.timezone)))
    data = []
    for first, last in [(start, end), (start.replace(year=start.year-1), previous_end)]:
        inv = monthly(invoice_query, "issue_date", first, last, Sum("subtotal"))
        credit = monthly(credit_query, "date", first, last, Sum("subtotal"))
        counts = monthly(orders, "day", first, last, Count("pk")) if "sales.view" in permissions else {}
        data.append((inv, credit, counts))
    series = [dict(month=f"{month:02}", revenue=data[0][0].get(month, ZERO)-data[0][1].get(month, ZERO), previousRevenue=data[1][0].get(month, ZERO)-data[1][1].get(month, ZERO), orders=data[0][2].get(month, 0) if "sales.view" in permissions else None, previousOrders=data[1][2].get(month, 0) if "sales.view" in permissions else None, margin=None, previousMargin=None) for month in range(1, end.month+1)]
    return dict(revenue=net, count=totals["count"], orders=sum(data[0][2].values()) if "sales.view" in permissions else None, series=series)


def inventory_kpis(company, permissions):
    if "inventory.view" not in permissions:
        return dict(value=None, turnover=None, dormantValue=None, segments=[], lowStock=None)
    from apps.inventory.valuation import assert_supported_valuation
    assert_supported_valuation(company)
    levels = StockLevel.objects.filter(company=company, product__company=company, warehouse__company=company)
    products = Product.objects.filter(company=company, kind="product", is_active=True).annotate(stock=summed_subquery(levels, "product_id", "quantity_on_hand"))
    counts = products.aggregate(empty=Count("pk", filter=Q(stock=0)), low=Count("pk", filter=Q(stock__gt=0, stock__lt=F("minimum_stock"))), normal=Count("pk", filter=Q(stock__gt=0, stock__gte=F("minimum_stock"))))
    last = StockMovement.objects.filter(company=company, product_id=OuterRef("product_id"), warehouse_id=OuterRef("warehouse_id"), product__company=company, warehouse__company=company).order_by().values("product_id").annotate(day=Max("date")).values("day")
    dormant = levels.annotate(last_movement=Subquery(last)).filter(quantity_on_hand__gt=0, last_movement__lt=company_today(company)-timedelta(days=90))
    return dict(value=amount(levels, "total_value"), turnover=None, dormantValue=amount(dormant, "total_value"), lowStock=counts["empty"]+counts["low"], segments=[dict(label=label, count=counts[key], color=color) for key, label, color in [("normal", "Stock normal", "#16a34a"), ("low", "Sous le minimum", "#d97706"), ("empty", "Sans stock", "#dc2626")]])


def top_customers(company, start, end, permissions):
    if not {"customers.view", "invoices.view"}.issubset(permissions):
        return []
    invoices = eligible_invoices(company)
    query = Customer.objects.filter(company=company).annotate(revenue=summed_subquery(invoices.filter(issue_date__range=(start, end)), "customer_id", "subtotal")-summed_subquery(credits(company).filter(date__range=(start, end)), "customer_id", "subtotal"), outstanding=summed_subquery(invoices, "customer_id", "balance_due"))
    return [dict(id=str(row["pk"]), name=row["name"], revenue=row["revenue"], outstanding=row["outstanding"], orders=None, trend=None) for row in query.filter(revenue__gt=0).order_by("-revenue", "pk").values("pk", "name", "revenue", "outstanding")[:5]]


def top_products(company, start, end, permissions):
    if not {"products.view", "invoices.view"}.issubset(permissions):
        return []
    lines = InvoiceLine.objects.filter(company=company, invoice__in=eligible_invoices(company).filter(issue_date__range=(start, end)), product__company=company)
    returns = CreditNoteLine.objects.filter(company=company, credit_note__in=credits(company).filter(date__range=(start, end)), product__company=company)
    query = Product.objects.filter(company=company).annotate(revenue=summed_subquery(lines, "product_id", "subtotal")-summed_subquery(returns, "product_id", "subtotal"), units=summed_subquery(lines, "product_id", "quantity")-summed_subquery(returns, "product_id", "quantity"))
    return [dict(id=str(row["pk"]), name=row["name"], revenue=row["revenue"], units=row["units"], margin=None, stock=None, stockLabel="Voir le stock", status="neutral", trend=None) for row in query.filter(revenue__gt=0).order_by("-revenue", "pk").values("pk", "name", "revenue", "units")[:5]]


def get_dashboard(company, permissions):
    today = company_today(company)
    start = today.replace(month=1, day=1)
    sales = sales_kpis(company, start, today, permissions)
    inventory = inventory_kpis(company, permissions)
    receivables = balance_summary(company) if "invoices.view" in permissions else None
    payables = balance_summary(company, True) if "supplier_invoices.view" in permissions else None
    expenses = get_expenses_summary(company, start, today) if "expenses.view" in permissions else None
    cash_allowed = {"finance.view", "cashflow.view"}.issubset(permissions)
    cash = get_cash_flow_summary(company, start, today) if cash_allowed else None
    customers = top_customers(company, start, today, permissions)
    customer_count = Customer.objects.filter(company=company).count() if "customers.view" in permissions else None
    kpis = []
    for key, title, value, fmt, subtitle in [
        ("revenue", "Chiffre d’affaires HT", sales["revenue"], "currency", "Factures comptabilisées moins avoirs, année en cours"),
        ("profit", "Bénéfice brut", None, "currency", "Coût des ventes comptabilisé indisponible"),
        ("margin", "Marge brute", None, "percentage", "Coûts historiques indisponibles"),
        ("cash", "Solde bancaire", None, "currency", "Solde initial bancaire indisponible"),
        ("receivables", "Créances actuelles TTC", receivables["total"] if receivables else None, "currency", "Reste dû sur factures comptabilisées"),
        ("overdue", "Créances échues TTC", receivables["overdue"] if receivables else None, "currency", "Échéance antérieure à aujourd’hui"),
        ("inventory", "Valeur du stock HT", inventory["value"], "currency", "Coût moyen pondéré, stock actuel"),
        ("customers", "Clients", customer_count, "number", "Clients enregistrés dans la société")]:
        kpis.append(dict(id=key, title=title, value=value, format=fmt, subtitle=subtitle, change="Situation ERP", trend="stable", status="neutral"))
    alerts = []
    if receivables and receivables["overdueCount"]:
        alerts.append(dict(id="overdue", severity="warning", category="Finance", title="Factures échues", description=f"{receivables['overdueCount']} facture(s) avec un reste dû.", impact=receivables["overdue"], kind="fact", action="/invoices"))
    buckets = [dict(label=row["label"], amount=row["amount"], color=color) for row, color in zip(aging_buckets(company) if receivables else [], ["#16a34a", "#84cc16", "#eab308", "#f97316", "#dc2626"])]
    recent = []
    if "invoices.view" in permissions:
        for inv in eligible_invoices(company).select_related("customer").order_by("-issue_date", "-pk")[:5]:
            recent.append(dict(id=str(inv.pk), customer=inv.customer.name, date=inv.issue_date, dueDate=inv.due_date, amount=inv.total, status="paid" if inv.balance_due == 0 else "overdue" if inv.due_date < today else "partial" if inv.amount_paid else "sent", overdueDays=max(0, (today-inv.due_date).days)))
    limitations = "CA HT net des avoirs et dépenses approuvées HT sur l’année en cours. Créances, dettes et stock actuels. Trésorerie : flux confirmés uniquement, sans solde bancaire. Coût des ventes, marge, DSO, rotation et score de santé indisponibles."
    return dict(currency=company.currency, permissions=permissions, period=dict(label=f"{start.isoformat()} – {today.isoformat()}", quarter=f"Année {today.year}", currentYear=today.year, previousYear=today.year-1, asOf=today.isoformat()), branch=company.name,
        kpis=kpis, summary=dict(score=None, status="Faits ERP", confidence=None, generatedAt=timezone.now().isoformat(), text=limitations, risks=[alert["description"] for alert in alerts], opportunities=[], recommendations=[]),
        revenue=sales["series"], revenueBreakdown=dict(revenue=sales["revenue"], expenses=expenses["subtotal"] if expenses else None, grossProfit=None, margin=None, suggestion=limitations),
        cashFlow=dict(current=None, inflows=cash["incoming"] if cash else None, outflows=cash["outgoing"] if cash else None, projected=None, points=get_cash_flow_series(company, start, today) if cash else [], status="Flux nets cumulés depuis le 1er janvier ; solde bancaire inconnu."),
        receivables=dict(total=receivables["total"] if receivables else None, dso=None, overdueCount=receivables["overdueCount"] if receivables else None, buckets=buckets), inventory=inventory, alerts=alerts, topCustomers=customers,
        topCustomersShare=(sum((row["revenue"] for row in customers), ZERO)/sales["revenue"]*100) if customers and sales["revenue"] and sales["revenue"]>0 else None,
        topProducts=top_products(company, start, today, permissions), recentInvoices=recent,
        metrics=dict(payables=payables, receivables=receivables, expenses=expenses, cashFlow=cash, invoiceCount=sales["count"], salesOrderCount=sales["orders"], inventoryValue=inventory["value"]), source=limitations)
