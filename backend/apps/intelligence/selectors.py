from datetime import timedelta
from zoneinfo import ZoneInfo
from django.db.models import Avg, Case, Count, ExpressionWrapper, DurationField, F, Q, Value, When
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied
from apps.accounts.models import Membership
from apps.accounts.selectors import get_effective_permission_codes
from apps.notifications.selectors import entity_queryset
from .constants import ACTIVE, RISK_TTL, allowed_rules, FORECAST_PERMISSIONS
from .detection import business_health
from .models import AIAlert, IntelligenceRun, ForecastRun


def context(company, membership):
    member = Membership.objects.select_related("company", "user").filter(pk=getattr(membership, "pk", None), company=company,
        user_id=getattr(membership, "user_id", None), status="active", company__is_active=True, user__is_active=True).first()
    if member is None:
        raise PermissionDenied()
    codes = get_effective_permission_codes(membership=member)
    if "ai.use" not in codes:
        raise PermissionDenied()
    return member, codes


def alert_queryset(company, codes):
    rules = allowed_rules(codes)
    entities = Q(pk__in=[])
    if "overdue_invoice" in rules:
        entities |= Q(alert_type="overdue_invoice", entity_type="invoice", entity_id__in=entity_queryset("invoice", company.pk, None).values("pk"), warehouse__isnull=True)
    if "low_stock" in rules:
        entities |= Q(alert_type="low_stock", entity_type="product", entity_id__in=entity_queryset("product", company.pk, None).values("pk"), warehouse__company=company)
    if "negative_cash_flow" in rules:
        entities |= Q(alert_type="negative_cash_flow", entity_type="company", entity_id=company.pk, warehouse__isnull=True)
    if "expense_spike" in rules:
        entities |= Q(alert_type="expense_spike", entity_type="company", entity_id=company.pk, warehouse__isnull=True)
    return AIAlert.objects.filter(company=company).filter(entities)


def alert_by_id(company, codes, identifier):
    obj = alert_queryset(company, codes).filter(pk=identifier).first()
    if obj is None:
        raise NotFound()
    return obj


def filtered_alerts(query, data, company):
    if data.get("anomaly_type"):
        query = query.filter(alert_type=data["anomaly_type"])
    for key in ["severity", "alert_type"]:
        if data.get(key):
            query = query.filter(**{key: data[key]})
    if data.get("source"):
        query = query.filter(source=data["source"])
    if data.get("domain"):
        query = query.filter(alert_type__in={"finance": ["negative_cash_flow", "expense_spike"], "receivables": ["overdue_invoice"], "inventory": ["low_stock"]}[data["domain"]])
    if data.get("type"):
        query = query.filter(source="statistical") if data["type"] == "analysis" else query.exclude(source="statistical") if data["type"] == "fact" else query.none()
    if data.get("status"):
        query = query.filter(status="acknowledged" if data["status"] == "investigating" else data["status"])
    if data.get("department"):
        rules = {"Finance": ["negative_cash_flow", "expense_spike"], "Clients": ["overdue_invoice"], "Stock": ["low_stock"]}.get(data["department"])
        query = query.filter(alert_type__in=rules) if rules else query.none()
    if data.get("search"):
        query = query.filter(Q(title__icontains=data["search"]) | Q(message__icontains=data["search"]))
    if data.get("days"):
        query = query.filter(detected_at__gte=timezone.now()-timedelta(days=data["days"]))
    if data.get("date_from") or data.get("date_to"):
        query = query.annotate(local_date=TruncDate("detected_at", tzinfo=ZoneInfo(company.timezone)))
        if data.get("date_from"):
            query = query.filter(local_date__gte=data["date_from"])
        if data.get("date_to"):
            query = query.filter(local_date__lte=data["date_to"])
    ordering = data.get("ordering", "date")
    if ordering == "severity":
        query = query.annotate(priority=Case(When(severity="critical", then=Value(0)), When(severity="high", then=Value(1)), When(severity="medium", then=Value(2)), default=Value(3)))
        return query.order_by("priority", "-detected_at", "-pk")
    if ordering == "department":
        return query.order_by("alert_type", "-detected_at", "-pk")
    return query.order_by("-detected_at", "-pk")


def observation(obj, key):
    value = obj.metadata.get(key)
    return str(value)[:180] if isinstance(value, (str, int, float)) else ""


def alert_payload(obj):
    rule = obj.alert_type
    department, metric = {"overdue_invoice": ("Clients", "Solde échu"), "low_stock": ("Stock", "Stock disponible"), "negative_cash_flow": ("Finance", "Flux net sur 30 jours"), "expense_spike": ("Finance", "Dépenses quotidiennes TTC")}[rule]
    value = observation(obj, "value")
    current = f"{value} {observation(obj, 'currency')}".strip()
    baseline = f"Minimum {observation(obj, 'minimum')}" if rule == "low_stock" else observation(obj, "due_date") if rule == "overdue_invoice" else "Encaissements − décaissements"
    if rule == "expense_spike":
        baseline = f"Médiane {obj.expected_value} ; seuil {observation(obj, 'threshold')}"
    facts = [dict(label=metric, value=current), dict(label="Seuil / période", value=baseline)]
    if rule == "low_stock":
        facts.append(dict(label="Dépôt", value=observation(obj, "warehouse")))
    return dict(id=str(obj.pk), title=obj.title, scope=observation(obj, "reference") or "Société active", department=department,
        severity=obj.severity, type="analysis" if obj.source == "statistical" else "fact", alertType=rule, source=obj.source, metric=metric, currentValue=current,
        method=obj.method, version=obj.analysis_version or None, periodDate=obj.period_date, observedValue=str(obj.observed_value) if obj.observed_value is not None else None,
        expectedValue=str(obj.expected_value) if obj.expected_value is not None else None,
        baseline=baseline, deviation=str(obj.deviation) if obj.deviation is not None else f"{observation(obj, 'days')} jour(s)" if rule == "overdue_invoice" else "Seuil franchi",
        impact="Exposition observée, sans estimation prédictive", confidence=None, detectedAt=obj.detected_at,
        lastSeenAt=obj.last_seen_at, status="investigating" if obj.status == "acknowledged" else obj.status,
        acknowledgedAt=obj.acknowledged_at, resolvedAt=obj.resolved_at, dismissedAt=obj.dismissed_at,
        conditionActive=obj.condition_active, facts=facts, analysis=obj.message, causes=[], estimates=[], recommendations=[],
        evidence=[] if rule in {"negative_cash_flow", "expense_spike"} else [dict(id=observation(obj, "reference"), kind="Facture" if rule == "overdue_invoice" else "Produit", description=obj.message)])


def risk_queryset(query):
    return query.filter(condition_active=True, status__in=ACTIVE, last_seen_at__gte=timezone.now()-RISK_TTL)


def risk_payload(obj):
    return dict(id=f"risk-{obj.pk}", alertId=str(obj.pk), label=obj.title, shortLabel=obj.alert_type,
        impact=None, probability=None, score=None, confidence=None, severity=obj.severity, source=obj.source,
        horizon="Situation observée", explanation=obj.message, detectedAt=obj.last_seen_at, expiresAt=obj.last_seen_at+RISK_TTL)


def run_payload(run, codes):
    # A revoked domain must also disappear from previously computed run totals.
    visible = set(run.rules).issubset(allowed_rules(codes))
    return dict(id=run.pk, status=run.status, createdAt=run.created_at, startedAt=run.started_at, completedAt=run.completed_at,
        errorCode=run.error_code or None, errorMessage=run.error_message or None, summary=run.summary if visible else None, horizon=run.horizon, granularity=run.granularity)


def forecast_queryset(company, codes):
    metrics = [metric for metric, needed in FORECAST_PERMISSIONS.items() if (needed | {"ai.use"}).issubset(codes)]
    return ForecastRun.objects.filter(company=company, intelligence_run__company=company, intelligence_run__status="completed", metric__in=metrics)


def forecast_payload(obj):
    from decimal import Decimal
    fields = ["metric", "granularity", "horizon", "version", "status", "model", "parameters", "metrics", "candidates", "forecast", "history", "minimumDays", "minimumActiveDays", "historyDays", "assumptions", "trainingStart", "trainingEnd", "validation", "total", "risk", "reason", "currency", "timezone", "asOfDay"]
    result = {key: obj.result[key] for key in fields if key in obj.result}
    stale = obj.created_at < timezone.now()-RISK_TTL or result.get("currency") != obj.company.currency or result.get("timezone") != obj.company.timezone
    title = "Chiffre d’affaires HT net" if obj.metric == "revenue" else "Flux net de trésorerie"
    if obj.status == "completed":
        detail = f"Total prévu : {result['total']} {result['currency']}. Modèle {obj.model_name}, MAE de validation {obj.mae}."
        if obj.metric == "net_cash_flow":
            detail += " Ce flux ne prédit pas le solde bancaire."
    else:
        detail = f"Historique insuffisant : {result.get('historyDays', 0)} jours ; minimum {result.get('minimumDays')} jours et 14 journées avec événements."
    risk = obj.status == "completed" and obj.metric == "net_cash_flow" and Decimal(result["total"]) < 0
    return dict(id=str(obj.pk), title=title, detail=detail, horizon=f"{obj.horizon} jours", horizonDays=obj.horizon,
        confidence=None, severity="high" if risk else "low", source="statistical", assumptions=result.get("assumptions", ""),
        generatedAt=obj.created_at, stale=stale, expiresAt=obj.created_at+RISK_TTL, result=result)


def latest_forecasts(company, codes):
    # Exactly two metric lookups; no per-record/point queries or stale fallback on insufficient data.
    query = forecast_queryset(company, codes).select_related("company")
    return [forecast_payload(obj) for metric in FORECAST_PERMISSIONS if (obj := query.filter(metric=metric).first()) is not None]


def anomaly_history(query, company):
    from common.dates import company_today
    today = company_today(company)
    start = today-timedelta(days=29)
    zone = ZoneInfo(company.timezone)
    counts = query.annotate(day=TruncDate("detected_at", tzinfo=zone)).filter(day__gte=start, day__lte=today).order_by().values("day", "severity").annotate(count=Count("pk"))
    resolutions = query.filter(status="resolved").annotate(day=TruncDate("resolved_at", tzinfo=zone)).filter(day__gte=start, day__lte=today).order_by().values("day").annotate(count=Count("pk"))
    result = {start+timedelta(days=i): dict(day=(start+timedelta(days=i)).isoformat(), critical=0, high=0, medium=0, resolved=0) for i in range(30)}
    for row in counts:
        if row["severity"] in result[row["day"]]:
            result[row["day"]][row["severity"]] = row["count"]
    for row in resolutions:
        result[row["day"]]["resolved"] = row["count"]
    cohort = query.annotate(day=TruncDate("detected_at", tzinfo=zone)).filter(day__gte=start, day__lte=today)
    totals = cohort.aggregate(total=Count("pk"), resolved=Count("pk", filter=Q(status="resolved")), response=Avg(ExpressionWrapper(F("acknowledged_at")-F("detected_at"), output_field=DurationField())))
    return list(result.values()), round(totals["resolved"]*100/totals["total"], 1) if totals["total"] else None, round(totals["response"].total_seconds()/60, 1) if totals["response"] is not None else None


def control_center(company, membership):
    member, codes = context(company, membership)
    query = alert_queryset(company, codes)
    health = business_health(company, codes)
    totals = query.aggregate(critical=Count("pk", filter=Q(status__in=ACTIVE, severity="critical")), warnings=Count("pk", filter=Q(status__in=ACTIVE, severity__in=["high", "medium"])), resolved=Count("pk", filter=Q(status="resolved")))
    risks = list(risk_queryset(query).order_by("-last_seen_at", "-pk")[:10])
    history, rate, response = anomaly_history(query, company)
    latest = IntelligenceRun.objects.filter(company=company, requested_by_id=member.user_id).first()
    latest_payload = run_payload(latest, codes) if latest else None
    forecasts = latest_forecasts(company, codes)
    last_analysis = IntelligenceRun.objects.filter(company=company, status="completed").order_by("-completed_at").values_list("completed_at", flat=True).first()
    from .opportunity_selectors import opportunity_queryset, opportunity_payload
    opportunities = opportunity_queryset(company, codes).filter(effective_status__in=ACTIVE, condition_active=True, currency=company.currency)
    now = timezone.now()
    return dict(period=dict(label="Situation actuelle · flux sur 30 jours", asOf=now, generatedAt=now), health=health,
        stats=dict(**totals, forecasts=sum(f["result"]["status"] == "completed" and not f["stale"] for f in forecasts), opportunities=opportunities.count(), lastAnalysisAt=last_analysis),
        summary=dict(text=health["explanation"], confidence=None, priorities=[obj.title for obj in risks[:5]], impacts=[], recommendations=[], sources=list(health["metrics"]), model="Règles ERP, anomalies IQR et prévisions statistiques évaluées"),
        alerts=[alert_payload(obj) for obj in query[:10]], alertsCount=query.count(), risks=[risk_payload(obj) for obj in risks],
        forecasts=forecasts,
        opportunities=[opportunity_payload(obj) for obj in opportunities[:5]], actions=[], governance=[], anomalyHistory=history, resolutionRate=rate, responseMinutes=response, assignees=[],
        lastRun=latest_payload, permissions=codes,
        anomalyAnalysis=(latest_payload.get("summary") or {}).get("anomalies") if latest_payload else None,
        recentActivity=[dict(id=r.pk, status=r.status, createdAt=r.created_at, completedAt=r.completed_at) for r in IntelligenceRun.objects.filter(company=company, requested_by_id=member.user_id)[:5]],
        capabilities=dict(anomalies="rule_based_and_statistical", forecasts="statistical" if any((p | {"ai.use"}).issubset(codes) for p in FORECAST_PERMISSIONS.values()) else "not_available", toolsEngine="not_available", score="not_available"))
