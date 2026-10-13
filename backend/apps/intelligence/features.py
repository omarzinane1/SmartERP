"""Bounded daily SQL aggregates. Monetary values remain Decimal throughout.

Dates are ledger DateFields (local business dates). No synthetic pre-history:
calendar gaps become zero only after the first eligible event in the window.
This assumes the ERP ledger is complete; import completeness is not recorded.
"""
from datetime import timedelta
from django.db.models import Sum
from apps.finance.summary_selectors import (
    ZERO, approved_expenses, completed_payments, eligible_invoices,
    posted_credits, get_cash_flow_series,
)

MAX_HISTORY = 180


def daily_amounts(query, date_field, amount_field, start, end):
    rows = query.filter(**{f"{date_field}__range": (start, end)}).order_by().values(date_field).annotate(value=Sum(amount_field))
    return {row[date_field]: row["value"] for row in rows}


def build_series(company, metric, end, days=MAX_HISTORY):
    if not 1 <= days <= MAX_HISTORY:
        raise ValueError("History must be between 1 and 180 days")
    start = end-timedelta(days=days-1)
    if metric == "revenue":
        invoices = daily_amounts(eligible_invoices(company), "issue_date", "subtotal", start, end)
        credits = daily_amounts(posted_credits(company), "date", "subtotal", start, end)
        events = set(invoices) | set(credits)
        values = {day: invoices.get(day, ZERO)-credits.get(day, ZERO) for day in events}
    elif metric == "expenses":
        values = daily_amounts(approved_expenses(company), "date", "total", start, end)
        events = set(values)
    elif metric == "net_cash_flow":
        events = set(completed_payments(company).filter(date__range=(start, end)).order_by().values_list("date", flat=True).distinct())
        # Official daily net, not its cumulative 'actual' column.
        values = {row["date"]: row["net"] for row in get_cash_flow_series(company, start, end)}
        values = {day: values[day.isoformat()] for day in events}
    else:
        raise ValueError("Unsupported metric")
    if not events:
        return []
    first = min(events)
    return [dict(date=first+timedelta(days=i), value=values.get(first+timedelta(days=i), ZERO),
                 activity=(first+timedelta(days=i)) in events) for i in range((end-first).days+1)]
