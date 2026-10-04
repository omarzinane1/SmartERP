"""Financial aggregates share persisted ledgers; all sums run in PostgreSQL."""
from datetime import timedelta
from decimal import Decimal
from django.db.models import Sum, Count, Q
from common.dates import company_today
from apps.sales.models import Invoice, CreditNote
from apps.purchasing.models import SupplierInvoice
from apps.inventory.models import StockLevel
from apps.inventory.valuation import assert_supported_valuation
from .models import Payment, Expense

ZERO = Decimal("0.00")


def amount(query, field):
    return query.aggregate(value=Sum(field))["value"] or ZERO


def completed_payments(company):
    return Payment.objects.filter(company=company, status="completed", currency=company.currency).filter(
        Q(direction="incoming", customer__company=company) | Q(direction="outgoing", supplier__company=company))


def get_cash_inflows(company, from_date, to_date):
    return completed_payments(company).filter(direction="incoming", date__range=(from_date, to_date))


def get_cash_outflows(company, from_date, to_date):
    return completed_payments(company).filter(direction="outgoing", date__range=(from_date, to_date))


def get_cash_flow_summary(company, from_date, to_date):
    totals = completed_payments(company).filter(date__range=(from_date, to_date)).aggregate(
        incoming=Sum("amount", filter=Q(direction="incoming")), outgoing=Sum("amount", filter=Q(direction="outgoing")), count=Count("pk"))
    incoming, outgoing = totals["incoming"] or ZERO, totals["outgoing"] or ZERO
    return dict(opening=None, openingDate=None, cash=None, incoming=incoming, outgoing=outgoing,
        netCashFlow=incoming-outgoing, transactionCount=totals["count"], fromDate=from_date.isoformat(), toDate=to_date.isoformat(),
        source="Paiements confirmés uniquement, selon leur date effective. Cumul net depuis le début de la période, sans solde initial bancaire. Les dépenses approuvées ne sont pas des paiements. Les annulations sont exclues.")


def get_cash_flow_series(company, from_date, to_date):
    daily = completed_payments(company).filter(date__range=(from_date, to_date)).order_by().values("date").annotate(
        incoming=Sum("amount", filter=Q(direction="incoming")), outgoing=Sum("amount", filter=Q(direction="outgoing")))
    by_date = {row["date"]: row for row in daily}
    running, result, day = ZERO, [], from_date
    while day <= to_date:
        row = by_date.get(day, {})
        incoming, outgoing = row.get("incoming") or ZERO, row.get("outgoing") or ZERO
        running += incoming-outgoing
        result.append(dict(date=day.isoformat(), actual=running, incoming=incoming, outgoing=outgoing, net=incoming-outgoing))
        day += timedelta(days=1)
    return result


def eligible_invoices(company, supplier=False):
    model, partner = (SupplierInvoice, "supplier") if supplier else (Invoice, "customer")
    return model.objects.filter(company=company, status="posted", currency=company.currency, **{f"{partner}__company": company})


def balance_summary(company, supplier=False):
    today = company_today(company)
    return eligible_invoices(company, supplier).filter(balance_due__gt=0).aggregate(
        total=Sum("balance_due", default=ZERO), count=Count("pk"), overdue=Sum("balance_due", filter=Q(due_date__lt=today), default=ZERO),
        overdueCount=Count("pk", filter=Q(due_date__lt=today)))


def aging_buckets(company, supplier=False):
    today = company_today(company)
    conditions = [
        ("current", "Non échues", Q(due_date__gte=today)),
        ("1_30", "1 à 30 jours", Q(due_date__lt=today, due_date__gte=today-timedelta(days=30))),
        ("31_60", "31 à 60 jours", Q(due_date__lt=today-timedelta(days=30), due_date__gte=today-timedelta(days=60))),
        ("61_90", "61 à 90 jours", Q(due_date__lt=today-timedelta(days=60), due_date__gte=today-timedelta(days=90))),
        ("90_plus", "Plus de 90 jours", Q(due_date__lt=today-timedelta(days=90))),
    ]
    aggregates = {}
    for key, _, condition in conditions:
        aggregates[f"amount_{key}"] = Sum("balance_due", filter=condition, default=ZERO)
        aggregates[f"count_{key}"] = Count("pk", filter=condition)
    values = eligible_invoices(company, supplier).filter(balance_due__gt=0).aggregate(**aggregates)
    return [dict(key=key, label=label, amount=values[f"amount_{key}"], count=values[f"count_{key}"]) for key, label, _ in conditions]


def get_expenses_summary(company, from_date, to_date):
    # Accrual expenditure; never added to the payment cash ledger.
    return Expense.objects.filter(company=company, status__in=["approved", "paid"], date__range=(from_date, to_date)).aggregate(
        total=Sum("total", default=ZERO), subtotal=Sum("amount_ht", default=ZERO), count=Count("pk"))


def get_finance_kpis(company, from_date, to_date, permissions):
    invoices = eligible_invoices(company).filter(issue_date__range=(from_date, to_date))
    credits = CreditNote.objects.filter(company=company, status="posted", customer__company=company, original_invoice__company=company, date__range=(from_date, to_date))
    inventory = None
    if "inventory.view" in permissions:
        assert_supported_valuation(company)
        inventory = amount(StockLevel.objects.filter(company=company, product__company=company, warehouse__company=company), "total_value")
    return dict(revenue=amount(invoices, "subtotal")-amount(credits, "subtotal"), receivables=balance_summary(company),
        payables=balance_summary(company, True), expenses=get_expenses_summary(company, from_date, to_date),
        cashFlow=get_cash_flow_summary(company, from_date, to_date), inventoryValue=inventory, grossMargin=None,
        balanceAsOf=company_today(company).isoformat(), fromDate=from_date.isoformat(), toDate=to_date.isoformat(),
        limitations="Créances, dettes et stock : situation actuelle, non reconstitution historique. Chiffre d'affaires HT net des avoirs datés sur la période. Marge indisponible sans coût des ventes comptabilisé.")


def upcoming_payments(company, permissions):
    result = dict(customers=[], suppliers=[])
    for supplier, key, permission, path, partner in [(False, "customers", "invoices.view", "invoices", "customer"), (True, "suppliers", "supplier_invoices.view", "supplier-invoices", "supplier")]:
        if permission not in permissions:
            continue
        rows = eligible_invoices(company, supplier).filter(balance_due__gt=0).select_related(partner).order_by("due_date", "pk")[:100]
        result[key] = [dict(id=obj.pk, reference=obj.number, partnerName=getattr(obj, partner).name, dueDate=obj.due_date.isoformat(), amount=obj.balance_due, path=f"/{path}/{obj.pk}") for obj in rows]
    return result
