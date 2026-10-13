"""Deterministic Decimal baselines and OLS trend; temporal holdout, then refit.

No float boundary, random state, probability or fabricated prediction interval.
Both metrics are signed (revenue includes dated credits; cash excludes balance).
"""
from datetime import timedelta
from decimal import Decimal, localcontext
from .constants import ANALYTICS_VERSION
from .features import build_series

MODELS = ("naive", "moving_average_7", "linear_trend")
POLICY = {7: dict(minimum_days=56, holdout=7), 30: dict(minimum_days=120, holdout=30)}
ASSUMPTIONS = "Journal ERP supposé complet ; jours sans événement à zéro après le premier événement. Journée courante exclue. Pas de saisonnalité, intervalle ni probabilité."


def money(value):
    if not value.is_finite() or abs(value) >= Decimal("1e22"):
        raise ValueError("Analytical amount outside supported range")
    return str(value.quantize(Decimal("0.01")))


def predict(values, count, model):
    if not values or count < 1:
        raise ValueError("Empty training series or invalid horizon")
    if model == "naive":
        return [values[-1]]*count, {}
    if model == "moving_average_7":
        window = min(7, len(values))
        mean = sum(values[-window:])/window
        return [mean]*count, dict(window=window, level=str(mean))
    if model != "linear_trend" or len(values) < 2:
        raise ValueError("Invalid trend model")
    n = len(values)
    xmean = Decimal(n-1)/2
    ymean = sum(values)/n
    slope = sum((Decimal(i)-xmean)*(value-ymean) for i, value in enumerate(values))/sum((Decimal(i)-xmean)**2 for i in range(n))
    intercept = ymean-slope*xmean
    return [intercept+slope*(n+i) for i in range(count)], dict(slope=str(slope), intercept=str(intercept), originIndex=0)


def evaluate_series(series, metric, horizon=7, granularity="day"):
    if type(horizon) is not int or horizon not in POLICY or granularity != "day":
        raise ValueError("Supported horizons: 7 or 30 days")
    if metric not in {"revenue", "net_cash_flow"}:
        raise ValueError("Unsupported forecast metric")
    if len(series) > 180 or any(series[i]["date"]-series[i-1]["date"] != timedelta(days=1) for i in range(1, len(series))):
        raise ValueError("Expected at most 180 consecutive daily observations")
    policy = POLICY[horizon]
    result = dict(metric=metric, granularity=granularity, horizon=horizon, version=ANALYTICS_VERSION,
        status="INSUFFICIENT_DATA", model=None, parameters={}, metrics=None, candidates=[], forecast=[],
        history=[dict(date=p["date"].isoformat(), value=money(p["value"]), activity=p["activity"]) for p in series],
        minimumDays=policy["minimum_days"], minimumActiveDays=14, historyDays=len(series), assumptions=ASSUMPTIONS)
    active = [p for p in series if p["activity"]]
    if len(series) < policy["minimum_days"] or len(active) < 14 or (series[-1]["date"]-active[-1]["date"]).days > 14:
        result["reason"] = "Historique insuffisant ou dernière activité antérieure à 14 jours."
        return result
    values = [p["value"] for p in series]
    size = policy["holdout"]
    training, validation = values[:-size], values[-size:]
    with localcontext() as ctx:
        ctx.prec = 38
        candidates = []
        for model in MODELS:
            predicted, _ = predict(training, size, model)
            errors = [actual-estimate for actual, estimate in zip(validation, predicted)]
            mae = sum(abs(e) for e in errors)/size
            rmse = (sum(e*e for e in errors)/size).sqrt()
            candidates.append((mae, rmse, model))
        # Stable ties prefer the simpler baseline in MODELS order.
        mae, rmse, selected = min(candidates, key=lambda candidate: candidate[0])
        predictions, parameters = predict(values, horizon, selected)
        result.update(status="completed", model=selected, parameters=parameters,
            trainingStart=series[0]["date"].isoformat(), trainingEnd=series[-1]["date"].isoformat(),
            validation=dict(trainingEnd=series[-size-1]["date"].isoformat(), start=series[-size]["date"].isoformat(), end=series[-1]["date"].isoformat(), days=size),
            metrics=dict(mae=money(mae), rmse=money(rmse)),
            candidates=[dict(model=m, mae=money(a), rmse=money(r)) for a, r, m in candidates],
            forecast=[dict(date=(series[-1]["date"]+timedelta(days=i+1)).isoformat(), value=money(value), lowerBound=None, upperBound=None) for i, value in enumerate(predictions)])
        result["total"] = money(sum(Decimal(p["value"]) for p in result["forecast"]))
        result["risk"] = metric == "net_cash_flow" and Decimal(result["total"]) < 0
    return result


def generate_forecast(company, metric, day, horizon=7, granularity="day"):
    result = evaluate_series(build_series(company, metric, day), metric, horizon, granularity)
    result.update(currency=company.currency, timezone=company.timezone, asOfDay=day.isoformat())
    return result
