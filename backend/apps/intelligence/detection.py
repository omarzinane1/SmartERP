"""Deterministic observations from official, tenant-scoped ERP selectors."""
from datetime import timedelta
from rest_framework.exceptions import ValidationError
from apps.finance.summary_selectors import overdue_invoices, balance_summary, get_cash_flow_summary
from apps.inventory.models import Warehouse
from apps.inventory.selectors import low_stock_queryset
from common.dates import company_today
from .constants import MAX_SIGNALS, allowed_rules


def collect_signals(company, rules):
    today, signals = company_today(company), []

    def add(**values):
        signals.append(values)
        if len(signals) > MAX_SIGNALS:
            raise ValidationError("Limite de détection dépassée ; aucun résultat partiel publié.")

    if "overdue_invoice" in rules:
        for obj in overdue_invoices(company).only("pk", "number", "balance_due", "due_date").order_by("pk")[:MAX_SIGNALS+1].iterator(chunk_size=500):
            age = (today-obj.due_date).days
            add(alert_type="overdue_invoice", fingerprint=f"invoice:{obj.pk}", severity="high" if age > 30 else "medium",
                title=f"Facture échue {obj.number}"[:180], message=f"Solde exigible de {obj.balance_due} {company.currency}, échéance dépassée de {age} jour(s).",
                entity_type="invoice", entity_id=obj.pk, warehouse_id=None,
                metadata=dict(reference=obj.number, value=str(obj.balance_due), currency=company.currency, due_date=obj.due_date.isoformat(), days=age))
    if "low_stock" in rules:
        for warehouse in Warehouse.objects.filter(company=company, is_active=True).order_by("pk").iterator(chunk_size=100):
            for product in low_stock_queryset(company, warehouse).order_by("pk")[:MAX_SIGNALS+1].iterator(chunk_size=500):
                add(alert_type="low_stock", fingerprint=f"stock:{product.pk}:{warehouse.pk}",
                    severity="critical" if product.available_stock <= 0 and product.minimum_stock > 0 else "high",
                    title=f"Stock au seuil : {product.reference}"[:180], message=f"Disponible {product.available_stock}, minimum {product.minimum_stock}, dépôt {warehouse.code}.",
                    entity_type="product", entity_id=product.pk, warehouse_id=warehouse.pk,
                    metadata=dict(reference=product.reference, value=str(product.available_stock), minimum=str(product.minimum_stock), warehouse=warehouse.code))
    if "negative_cash_flow" in rules:
        start = today-timedelta(days=29)
        cash = get_cash_flow_summary(company, start, today)
        if cash["netCashFlow"] < 0:
            add(alert_type="negative_cash_flow", fingerprint="cash:30d", severity="high", title="Flux net négatif sur 30 jours",
                message=f"Encaissements {cash['incoming']} moins décaissements {cash['outgoing']} = {cash['netCashFlow']} {company.currency}. Ce flux ne mesure pas le solde bancaire.",
                entity_type="company", entity_id=company.pk, warehouse_id=None,
                metadata=dict(value=str(cash["netCashFlow"]), incoming=str(cash["incoming"]), outgoing=str(cash["outgoing"]), currency=company.currency, from_date=start.isoformat(), to_date=today.isoformat()))
    return signals


def business_health(company, codes):
    rules, components, metrics = allowed_rules(codes), [], {}
    if "overdue_invoice" in rules:
        balances = balance_summary(company)
        metrics["receivables"] = balances
        components.append(dict(name="Clients", alerts=balances["overdueCount"], status="À surveiller" if balances["overdueCount"] else "Aucun impayé échu", tone="warning" if balances["overdueCount"] else "positive"))
    if "low_stock" in rules:
        count = empty = 0
        for warehouse in Warehouse.objects.filter(company=company, is_active=True).iterator(chunk_size=100):
            from django.db.models import Count, Q
            values = low_stock_queryset(company, warehouse).aggregate(count=Count("pk"), empty=Count("pk", filter=Q(available_stock__lte=0, minimum_stock__gt=0)))
            count += values["count"]
            empty += values["empty"]
        metrics["inventory"] = dict(lowStock=count, outOfStock=empty)
        components.append(dict(name="Stock", alerts=count, status="Rupture observée" if empty else "Seuil atteint" if count else "Aucun seuil atteint", tone="critical" if empty else "warning" if count else "positive"))
    if "negative_cash_flow" in rules:
        today = company_today(company)
        cash = get_cash_flow_summary(company, today-timedelta(days=29), today)
        metrics["cashFlow"] = cash
        negative = cash["netCashFlow"] < 0
        components.append(dict(name="Finance", alerts=int(negative), status="Flux net négatif" if negative else "Flux net non négatif", tone="warning" if negative else "positive"))
    status = "not_available" if not components else "critical" if any(c["tone"] == "critical" for c in components) else "warning" if any(c["tone"] == "warning" for c in components) else "healthy"
    return dict(score=None, trend=None, confidence=None, status=status, metrics=metrics,
        departments=[dict(**c, score=None, trend=None) for c in components],
        explanation="Statuts issus des créances échues, seuils de stock par dépôt et flux nets des 30 derniers jours. Aucun score de santé ou de solvabilité ; absence de signal ne signifie pas absence de risque.")
