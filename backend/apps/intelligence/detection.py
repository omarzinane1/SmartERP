"""Deterministic observations from official, tenant-scoped ERP selectors."""
from datetime import timedelta
from rest_framework.exceptions import ValidationError
from apps.finance.summary_selectors import overdue_invoices, get_cash_flow_summary
from apps.inventory.models import Warehouse
from apps.inventory.selectors import low_stock_queryset
from common.dates import company_today
from .constants import MAX_SIGNALS


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


# Compatibility import for existing callers.
from .health import business_health
