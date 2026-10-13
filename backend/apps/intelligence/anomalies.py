"""Daily expenditure outlier: robust, causal, positive activity-day baseline."""
from datetime import timedelta
from decimal import Decimal
from .features import build_series
from .constants import ANALYTICS_VERSION

WINDOW = 56
MIN_ACTIVE_DAYS = 20
MIN_CALENDAR_DAYS = 28


def quantile(values, fraction):
    ordered = sorted(values)
    position = (len(ordered)-1)*Decimal(fraction)
    index = int(position)
    return ordered[index]+(ordered[min(index+1, len(ordered)-1)]-ordered[index])*(position-index)


def expense_spike(company, day):
    series = build_series(company, "expenses", day, WINDOW+1)
    baseline = [p["value"] for p in series if p["date"] < day and p["activity"]]
    summary = dict(status="INSUFFICIENT_DATA", method="activity_day_iqr", version=ANALYTICS_VERSION,
        observations=len(baseline), minimum=MIN_ACTIVE_DAYS, windowDays=WINDOW, period=day.isoformat())
    if len(baseline) < MIN_ACTIVE_DAYS or (day-series[0]["date"]).days < MIN_CALENDAR_DAYS:
        return [], summary
    median, q1, q3 = (quantile(baseline, q) for q in ["0.5", "0.25", "0.75"])
    spread = q3-q1
    threshold = max(q3+3*spread, 2*median)
    observed = series[-1]["value"]
    summary.update(status="completed", threshold=str(threshold))
    if observed <= threshold:
        return [], summary
    critical = observed >= max(q3+6*spread, 5*median)
    deviation = observed-median
    description = (f"Dépenses TTC du {day}: {observed} {company.currency}, médiane des journées actives précédentes "
        f"{median} ; écart {deviation}. Seuil max(Q3 + 3×IQR, 2×médiane) = {threshold}, "
        f"sur {len(baseline)} journées actives, fenêtre de {WINDOW} jours.")
    return [dict(alert_type="expense_spike", fingerprint=f"expenses:{day}:total", severity="critical" if critical else "high",
        source="statistical", title=f"Pic de dépenses du {day}", message=description,
        entity_type="company", entity_id=company.pk, warehouse_id=None,
        method="activity_day_iqr", metric_name="expenses_ttc", analysis_version=ANALYTICS_VERSION, period_date=day,
        observed_value=observed, expected_value=median, deviation=deviation,
        metadata=dict(value=str(observed), baseline=str(median), threshold=str(threshold), q1=str(q1), q3=str(q3),
            currency=company.currency, observations=len(baseline), from_date=(day-timedelta(days=WINDOW)).isoformat(), to_date=(day-timedelta(days=1)).isoformat()))], summary
