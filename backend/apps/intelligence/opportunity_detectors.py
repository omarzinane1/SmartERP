"""Read-only detectors return bounded candidates, never business mutations."""
from datetime import timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo
from django.db.models import Count, DecimalField, F, Max, Min, Q, OuterRef, Subquery, Sum, Value
from django.db.models.functions import Coalesce, TruncDate
from rest_framework.exceptions import ValidationError
from apps.crm.selectors import customers_queryset
from apps.sales.order_selectors import order_queryset
from apps.finance.summary_selectors import ZERO, eligible_invoices, overdue_invoices, posted_credits
from apps.inventory.models import StockLevel, Warehouse
from apps.inventory.selectors import product_queryset, low_stock_queryset, movement_queryset
from apps.inventory.valuation import assert_supported_valuation
from apps.reporting.analytics import summed_subquery
from .anomalies import quantile
from . import opportunity_config as policy


def customers(company):
    return customers_queryset(company).exclude(status="archived").filter(Q(salesperson__isnull=True) | Q(salesperson__company=company))


def bounded(query):
    rows = list(query[:policy.MAX_CANDIDATES+1])
    if len(rows) > policy.MAX_CANDIDATES:
        raise ValidationError("Périmètre d'opportunités trop volumineux ; aucun résultat partiel publié.")
    return rows


def candidate(company, kind, entity, identifier, name, title, reason, description, metrics, *, priority="medium", value=None, warehouse=None, source="analytics", value_kind=None):
    return dict(opportunity_type=kind, domain=policy.DOMAINS[kind], fingerprint=f"{kind}:{entity}:{identifier}:{warehouse or 0}",
        title=title[:180], reason=reason[:1000], description=description[:1000], priority=priority,
        entity_type=entity, entity_id=identifier, warehouse_id=warehouse, estimated_value=value, currency=company.currency,
        confidence=None, source=source, detector=kind, version=policy.VERSION,
        metadata=dict(entity_name=name, value_kind=value_kind, metrics=metrics))


def customer_reactivation(company, day):
    start = day-timedelta(days=policy.HISTORY_DAYS-1)
    query = order_queryset(company).filter(customer__in=customers(company), currency=company.currency,
        status__in=["confirmed", "processing", "completed"]).annotate(local_day=TruncDate("confirmed_at", tzinfo=ZoneInfo(company.timezone)))
    rows = query.filter(local_day__range=(start, day)).order_by().values("customer_id", "customer__name").annotate(
        count=Count("pk"), last=Max("local_day"), amount=Sum("subtotal")).filter(count__gte=policy.MIN_CUSTOMER_ORDERS, last__lte=day-timedelta(days=policy.CUSTOMER_INACTIVITY_DAYS)).order_by("customer_id")
    return [candidate(company, "customer_reactivation", "customer", r["customer_id"], r["customer__name"], f"Reprendre contact avec {r['customer__name']}",
        f"{r['count']} commandes confirmées sur {policy.HISTORY_DAYS} jours, aucune depuis {(day-r['last']).days} jours (dernière : {r['last']}).",
        "Examiner l'historique et décider d'une prise de contact adaptée ; aucun revenu futur estimé.",
        dict(orders_count=r["count"], days_inactive=(day-r["last"]).days, last_order=r["last"].isoformat(), historical_orders_ht=str(r["amount"]), from_date=start.isoformat(), to_date=day.isoformat()), source="rule_based") for r in bounded(rows)]


def high_value_customer(company, day):
    start = day-timedelta(days=policy.HISTORY_DAYS-1)
    invoices = eligible_invoices(company).filter(issue_date__range=(start, day))
    credits = posted_credits(company).filter(date__range=(start, day))
    counts = invoices.filter(customer_id=OuterRef("pk")).order_by().values("customer_id").annotate(n=Count("pk")).values("n")
    latest = invoices.filter(customer_id=OuterRef("pk")).order_by("-issue_date").values("issue_date")[:1]
    query = customers(company).annotate(value=summed_subquery(invoices, "customer_id", "subtotal")-summed_subquery(credits, "customer_id", "subtotal"),
        invoice_count=Subquery(counts), last=Subquery(latest)).filter(value__gt=0).order_by("pk").values("pk", "name", "value", "invoice_count", "last")
    cohort = bounded(query)
    if len(cohort) < policy.VALUE_MIN_CUSTOMERS:
        return []
    threshold = quantile([r["value"] for r in cohort], "0.75")
    return [candidate(company, "high_value_customer", "customer", r["pk"], r["name"], f"Préparer une revue de compte : {r['name']}",
        f"CA HT net sur {policy.HISTORY_DAYS} jours : {r['value']} {company.currency}, au-dessus du 75e percentile ({threshold}) d'un groupe de {len(cohort)} clients ; {r['invoice_count']} factures, dernière le {r['last']}.",
        "Examiner les besoins du client à partir de sa valeur historique ; aucune vente additionnelle ni produit premium présumé.",
        dict(revenue_ht=str(r["value"]), percentile_75=str(threshold), customers_count=len(cohort), invoices_count=r["invoice_count"], last_invoice=r["last"].isoformat(), from_date=start.isoformat(), to_date=day.isoformat()))
        for r in cohort if r["value"] > threshold and r["invoice_count"] >= policy.MIN_CUSTOMER_ORDERS and r["last"] >= day-timedelta(days=policy.VALUE_RECENCY_DAYS)]


def receivable_collection(company, day):
    query = overdue_invoices(company).filter(customer__in=customers(company))
    total = query.aggregate(total=Sum("balance_due", default=ZERO))["total"]
    if total <= 0:
        return []
    rows = query.order_by().values("customer_id", "customer__name").annotate(value=Sum("balance_due"), count=Count("pk"), oldest=Min("due_date")).filter(
        value__gte=total*Decimal(policy.RECEIVABLE_SHARE), oldest__lte=day-timedelta(days=policy.RECEIVABLE_MIN_AGE)).order_by("customer_id")
    return [candidate(company, "receivable_collection", "customer", r["customer_id"], r["customer__name"], f"Prioriser les créances de {r['customer__name']}",
        f"{r['value']} {company.currency} échus sur {r['count']} facture(s), soit {r['value']/total*100:.1f} % des créances échues de la société ; échéance la plus ancienne : {r['oldest']}.",
        "Vérifier les factures et décider des relances. Le solde observé ne constitue pas une promesse de recouvrement.",
        dict(overdue_amount=str(r["value"]), company_overdue=str(total), invoices_count=r["count"], oldest_due=r["oldest"].isoformat(), age_days=(day-r["oldest"]).days),
        priority="high" if (day-r["oldest"]).days >= policy.RECEIVABLE_HIGH_AGE or r["value"] >= total*Decimal(policy.RECEIVABLE_HIGH_SHARE) else "medium", value=r["value"], value_kind="outstanding_receivable") for r in bounded(rows)]


def stock_replenishment(company, day):
    result = []
    start = day-timedelta(days=policy.DEMAND_DAYS-1)
    quantity = DecimalField(max_digits=30, decimal_places=3)
    for warehouse in Warehouse.objects.filter(company=company, is_active=True).order_by("pk").iterator(chunk_size=100):
        demand = movement_queryset(company).filter(warehouse=warehouse, product_id=OuterRef("pk"), movement_type="issue", quantity__lt=0,
            date__range=(start, day)).order_by().values("product_id").annotate(value=-Sum("quantity"), days=Count("date", distinct=True))
        rows = low_stock_queryset(company, warehouse).annotate(demand=Coalesce(Subquery(demand.values("value")), Value(ZERO), output_field=quantity),
            demand_days=Subquery(demand.values("days"))).filter(demand_days__gte=policy.MIN_DEMAND_DAYS, demand__gt=F("available_stock")).order_by("pk").values("pk", "name", "reference", "available_stock", "minimum_stock", "demand", "demand_days")
        for r in bounded(rows):
            gap = max(r["minimum_stock"], r["demand"])-r["available_stock"]
            result.append(candidate(company, "stock_replenishment", "product", r["pk"], r["name"], f"Examiner le réapprovisionnement de {r['reference']}",
                f"Dépôt {warehouse.code} : disponible {r['available_stock']}, minimum {r['minimum_stock']}, sorties opérationnelles {r['demand']} sur {r['demand_days']} journées des {policy.DEMAND_DAYS} derniers jours.",
                f"Écart de {gap} unités par rapport au maximum du minimum et des sorties historiques. Vérifier commandes en cours et délais avant de décider ; ce n'est pas une prévision de demande.",
                dict(available=str(r["available_stock"]), minimum=str(r["minimum_stock"]), historical_issues=str(r["demand"]), activity_days=r["demand_days"], review_quantity=str(gap), warehouse=warehouse.code, from_date=start.isoformat(), to_date=day.isoformat()),
                priority="high" if r["available_stock"] == 0 else "medium", warehouse=warehouse.pk, source="rule_based"))
            if len(result) > policy.MAX_CANDIDATES:
                raise ValidationError("Trop de candidats réapprovisionnement.")
    return result


def dormant_stock(company, day):
    assert_supported_valuation(company)
    latest = movement_queryset(company).filter(product_id=OuterRef("product_id"), warehouse_id=OuterRef("warehouse_id"), date__lte=day).order_by("-date").values("date")[:1]
    levels = StockLevel.objects.filter(company=company, product__in=product_queryset(company).filter(is_active=True, kind="product"),
        warehouse__company=company, warehouse__is_active=True, quantity_on_hand__gt=0, total_value__gt=0).annotate(last=Subquery(latest)).filter(
        last__lt=day-timedelta(days=policy.DORMANT_STOCK_DAYS)).order_by("pk").values("product_id", "product__name", "product__reference", "warehouse_id", "warehouse__code", "quantity_on_hand", "total_value", "last")
    return [candidate(company, "dormant_stock", "product", r["product_id"], r["product__name"], f"Examiner le stock dormant de {r['product__reference']}",
        f"Dépôt {r['warehouse__code']} : {r['quantity_on_hand']} unités, valeur comptable {r['total_value']} {company.currency}, aucun mouvement depuis le {r['last']} ({(day-r['last']).days} jours).",
        "Examiner une promotion ou une réduction des prochains achats. La valeur comptable immobilisée n'est pas un gain réalisable garanti.",
        dict(quantity=str(r["quantity_on_hand"]), inventory_value=str(r["total_value"]), last_movement=r["last"].isoformat(), inactivity_days=(day-r["last"]).days, warehouse=r["warehouse__code"]),
        value=r["total_value"], value_kind="book_inventory_value", warehouse=r["warehouse_id"], source="rule_based") for r in bounded(levels)]


DETECTORS = {function.__name__: function for function in [customer_reactivation, high_value_customer, receivable_collection, stock_replenishment, dormant_stock]}


def detect_company_opportunities(*, company, kinds, as_of):
    result = []
    for kind in kinds:
        result.extend(DETECTORS[kind](company, as_of))
        if len(result) > policy.MAX_CANDIDATES:
            raise ValidationError("Limite d'opportunités dépassée ; aucun résultat partiel publié.")
    return result
