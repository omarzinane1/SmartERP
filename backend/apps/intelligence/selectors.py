from datetime import timedelta
from zoneinfo import ZoneInfo
from django.db.models import Avg, Case, Count, ExpressionWrapper, DurationField, F, Q, Value, When
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied
from apps.accounts.models import Membership
from apps.accounts.selectors import get_effective_permission_codes
from apps.notifications.selectors import entity_queryset
from .constants import ACTIVE, RISK_TTL, allowed_rules
from .detection import business_health
from .models import AIAlert, IntelligenceRun


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
    return AIAlert.objects.filter(company=company).filter(entities)


def alert_by_id(company, codes, identifier):
    obj = alert_queryset(company, codes).filter(pk=identifier).first()
    if obj is None:
        raise NotFound()
    return obj


def filtered_alerts(query, data, company):
    for key in ["severity", "alert_type"]:
        if data.get(key):
            query = query.filter(**{key: data[key]})
    if data.get("type") and data["type"] != "fact":
        return query.none()
    if data.get("status"):
        query = query.filter(status="acknowledged" if data["status"] == "investigating" else data["status"])
    if data.get("department"):
        rule = {"Finance": "negative_cash_flow", "Clients": "overdue_invoice", "Stock": "low_stock"}.get(data["department"])
        query = query.filter(alert_type=rule) if rule else query.none()
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
    department, metric = {"overdue_invoice": ("Clients", "Solde échu"), "low_stock": ("Stock", "Stock disponible"), "negative_cash_flow": ("Finance", "Flux net sur 30 jours")}[rule]
    value = observation(obj, "value")
    current = f"{value} {observation(obj, 'currency')}".strip()
    baseline = f"Minimum {observation(obj, 'minimum')}" if rule == "low_stock" else observation(obj, "due_date") if rule == "overdue_invoice" else "Encaissements − décaissements"
    facts = [dict(label=metric, value=current), dict(label="Seuil / période", value=baseline)]
    if rule == "low_stock":
        facts.append(dict(label="Dépôt", value=observation(obj, "warehouse")))
    return dict(id=str(obj.pk), title=obj.title, scope=observation(obj, "reference") or "Société active", department=department,
        severity=obj.severity, type="fact", alertType=rule, source=obj.source, metric=metric, currentValue=current,
        baseline=baseline, deviation=f"{observation(obj, 'days')} jour(s)" if rule == "overdue_invoice" else "Seuil franchi",
        impact="Exposition observée, sans estimation prédictive", confidence=None, detectedAt=obj.detected_at,
        lastSeenAt=obj.last_seen_at, status="investigating" if obj.status == "acknowledged" else obj.status,
        acknowledgedAt=obj.acknowledged_at, resolvedAt=obj.resolved_at, dismissedAt=obj.dismissed_at,
        conditionActive=obj.condition_active, facts=facts, analysis=obj.message, causes=[], estimates=[], recommendations=[],
        evidence=[] if rule == "negative_cash_flow" else [dict(id=observation(obj, "reference"), kind="Facture" if rule == "overdue_invoice" else "Produit", description=obj.message)])


def risk_queryset(query):
    return query.filter(condition_active=True, status__in=ACTIVE, last_seen_at__gte=timezone.now()-RISK_TTL)


def risk_payload(obj):
    return dict(id=f"risk-{obj.pk}", alertId=str(obj.pk), label=obj.title, shortLabel=obj.alert_type,
        impact=None, probability=None, score=None, confidence=None, severity=obj.severity, source="RULE_BASED",
        horizon="Situation observée", explanation=obj.message, detectedAt=obj.last_seen_at, expiresAt=obj.last_seen_at+RISK_TTL)


def run_payload(run, codes):
    # A revoked domain must also disappear from previously computed run totals.
    visible = set(run.rules).issubset(allowed_rules(codes))
    return dict(id=run.pk, status=run.status, createdAt=run.created_at, startedAt=run.started_at, completedAt=run.completed_at,
        errorCode=run.error_code or None, errorMessage=run.error_message or None, summary=run.summary if visible else None)


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
    last_analysis = IntelligenceRun.objects.filter(company=company, status="completed").order_by("-completed_at").values_list("completed_at", flat=True).first()
    now = timezone.now()
    return dict(period=dict(label="Situation actuelle · flux sur 30 jours", asOf=now, generatedAt=now), health=health,
        stats=dict(**totals, forecasts=risk_queryset(query).count(), opportunities=0, lastAnalysisAt=last_analysis),
        summary=dict(text=health["explanation"], confidence=None, priorities=[obj.title for obj in risks[:5]], impacts=[], recommendations=[], sources=list(health["metrics"]), model="Règles déterministes ERP · aucun modèle ML"),
        alerts=[alert_payload(obj) for obj in query[:10]], alertsCount=query.count(), risks=[risk_payload(obj) for obj in risks],
        forecasts=[dict(id=f"risk-{obj.pk}", title=obj.title, detail=obj.message, horizon="Situation observée", confidence=None, severity=obj.severity, source="RULE_BASED", assumptions="Signal observé au dernier scan, valable 24 heures. Aucune prédiction.") for obj in risks],
        opportunities=[], actions=[], governance=[], anomalyHistory=history, resolutionRate=rate, responseMinutes=response, assignees=[],
        lastRun=run_payload(latest, codes) if latest else None, permissions=codes,
        recentActivity=[dict(id=r.pk, status=r.status, createdAt=r.created_at, completedAt=r.completed_at) for r in IntelligenceRun.objects.filter(company=company, requested_by_id=member.user_id)[:5]],
        capabilities=dict(anomalies="RULE_BASED", forecasts="not_available", toolsEngine="not_available", score="not_available"))
