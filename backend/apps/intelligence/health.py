"""Live, permission-scoped health. No arbitrary score, weights or margin."""
from datetime import timedelta
from decimal import Decimal
from django.db.models import Count, Q
from apps.finance.summary_selectors import balance_summary, get_cash_flow_summary, get_expenses_summary, get_revenue_summary
from apps.inventory.models import Warehouse
from apps.inventory.selectors import low_stock_queryset
from common.dates import company_today
from .constants import allowed_rules


def business_health(company, codes):
    rules, components, metrics, issues = allowed_rules(codes), [], {}, []
    today = company_today(company)
    start = today-timedelta(days=29)

    def dimension(name, reason, warning=False, critical=False, alerts=0, values=None):
        tone = "critical" if critical else "warning" if warning else "positive"
        components.append(dict(name=name, alerts=alerts, status="Critique" if critical else "À surveiller" if warning else "Aucun signal",
            reason=reason, metrics=values or {}, tone=tone, score=None, trend=None))
        if warning or critical:
            issues.append(dict(dimension=name, reason=reason, severity=tone))

    if "overdue_invoice" in rules:
        balances = balance_summary(company)
        balances["overdueRatio"] = balances["overdue"]/balances["total"]*100 if balances["total"] else None
        metrics["receivables"] = balances
        dimension("Clients", f"{balances['overdueCount']} facture(s) échue(s), {balances['overdue']} {company.currency} sur {balances['total']} de créances TTC.",
            warning=balances["overdueCount"] > 0, alerts=balances["overdueCount"], values=balances)
    if "low_stock" in rules:
        count = empty = 0
        for warehouse in Warehouse.objects.filter(company=company, is_active=True).iterator(chunk_size=100):
            values = low_stock_queryset(company, warehouse).aggregate(count=Count("pk"), empty=Count("pk", filter=Q(available_stock__lte=0, minimum_stock__gt=0)))
            count += values["count"]
            empty += values["empty"]
        metrics["inventory"] = dict(lowStock=count, outOfStock=empty)
        dimension("Stock", f"{count} couple(s) produit/dépôt au seuil minimum, dont {empty} en rupture avec minimum positif.",
            warning=count > 0, critical=empty > 0, alerts=count, values=metrics["inventory"])
    if "ai.use" in codes and "invoices.view" in codes:
        current = get_revenue_summary(company, start, today)
        previous = get_revenue_summary(company, start-timedelta(days=30), start-timedelta(days=1))
        growth = (current-previous)/previous*100 if previous > 0 else None
        metrics["sales"] = dict(revenue=current, previousRevenue=previous, growthPercent=growth, fromDate=start.isoformat(), toDate=today.isoformat())
        declining = growth is not None and growth <= Decimal("-20")
        dimension("Ventes", f"CA HT net des avoirs : {current} {company.currency}, contre {previous} sur les 30 jours précédents. Avertissement à partir de −20 % avec référence positive.",
            warning=declining, alerts=int(declining), values=metrics["sales"])
    financial, reasons, warnings = {}, [], 0
    if "negative_cash_flow" in rules:
        cash = get_cash_flow_summary(company, start, today)
        metrics["cashFlow"] = financial["cashFlow"] = cash
        warnings += int(cash["netCashFlow"] < 0)
        reasons.append(f"Flux net confirmé : {cash['netCashFlow']} {company.currency} sur 30 jours ; solde bancaire inconnu.")
    if "ai.use" in codes and "expenses.view" in codes:
        expenses = get_expenses_summary(company, start, today)
        metrics["expenses"] = financial["expenses"] = expenses
        reasons.append(f"Dépenses approuvées HT : {expenses['subtotal']} {company.currency} sur 30 jours.")
        if "sales" in metrics:
            high = expenses["subtotal"] > max(metrics["sales"]["revenue"], Decimal(0))
            financial["expensesExceedRevenue"] = high
            warnings += int(high)
            reasons.append("Avertissement si dépenses HT supérieures au CA HT positif (ou à zéro si CA négatif). Ce rapprochement n'est pas une marge.")
    if financial:
        dimension("Finance", " ".join(reasons), warning=warnings > 0, alerts=warnings, values=financial)
    if "ai.use" in codes and "supplier_invoices.view" in codes:
        payables = balance_summary(company, True)
        metrics["payables"] = payables
        dimension("Achats", f"Dettes fournisseurs TTC : {payables['total']} {company.currency}, dont {payables['overdue']} échues.",
            warning=payables["overdueCount"] > 0, alerts=payables["overdueCount"], values=payables)
    status = "not_available" if not components else "critical" if any(c["tone"] == "critical" for c in components) else "warning" if issues else "healthy"
    return dict(score=None, trend=None, confidence=None, status=status, metrics=metrics, issues=issues, departments=components,
        period=dict(fromDate=start.isoformat(), toDate=today.isoformat()), currency=company.currency,
        explanation="Indicateurs ERP autorisés : situation actuelle des créances, dettes et stocks ; ventes, dépenses et flux sur 30 jours. "
            + (" ".join(i["reason"] for i in issues) if issues else "Aucun seuil de surveillance franchi dans les sources autorisées.")
            + " Aucun score de solvabilité ; absence de signal ne signifie pas absence de risque.")
