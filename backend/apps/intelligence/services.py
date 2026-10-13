"""Detection writes only supervision records, never ERP financial or stock ledgers."""
from datetime import date, timedelta
import logging
from time import monotonic
from uuid import uuid4
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from apps.accounts.models import Membership
from apps.audit.models import IdempotencyKey
from apps.audit.services import record_audit_event
from apps.companies.models import Company
from common.dispatch import enqueue_after_commit
from common.exceptions import BusinessConflict
from common.idempotency import request_identity
from .constants import ACTIVE, RULE_PERMISSIONS, RUN_LEASE, allowed_rules, ANALYTICS_VERSION, MAX_SIGNALS
from .detection import collect_signals
from .models import AIAlert, IntelligenceRun, ForecastRun
from .anomalies import expense_spike
from .forecasting import generate_forecast
from .opportunity_detectors import detect_company_opportunities
from .opportunity_services import publish_opportunities
from common.dates import company_today
from .selectors import context, alert_queryset

logger = logging.getLogger(__name__)


def run_actor(run):
    membership = Membership.objects.filter(company_id=run.company_id, user_id=run.requested_by_id).first()
    member, codes = context(run.company, membership)
    if not run.rules or not set(run.rules).issubset(allowed_rules(codes)):
        raise PermissionDenied()
    return member


def audit_run(run, action, actor=None):
    record_audit_event(company=run.company, actor=actor, action=f"intelligence.{action}", entity=run,
        metadata=dict(run_id=run.pk, status=run.status, error_code=run.error_code, version=ANALYTICS_VERSION))


@transaction.atomic
def fail_run(run_id, code, token=None):
    run = IntelligenceRun.objects.select_for_update().filter(pk=run_id, status__in=["pending", "running"]).first()
    if run is None or (token is not None and run.claim_token != token):
        return
    run.status, run.error_code = "failed", code
    run.error_message = "Analyse indisponible ou interrompue. Vérifiez vos droits et réessayez."
    run.completed_at, run.claim_token = timezone.now(), None
    run.save(update_fields=["status", "error_code", "error_message", "completed_at", "claim_token"])
    audit_run(run, "failed")


def expire_runs(query=None):
    query = query if query is not None else IntelligenceRun.objects.all()
    count = 0
    for identifier in query.filter(status__in=["pending", "running"], lease_expires_at__lt=timezone.now()).values_list("pk", flat=True).iterator(chunk_size=100):
        with transaction.atomic():
            current = IntelligenceRun.objects.select_for_update().filter(pk=identifier, status__in=["pending", "running"], lease_expires_at__lt=timezone.now()).first()
            if current:
                fail_run(current.pk, "execution_expired")
                count += 1
    return count


@transaction.atomic
def request_refresh(*, company, membership, key, horizon=7, granularity="day"):
    if type(horizon) is not int or horizon not in {7, 30} or granularity != "day":
        raise ValidationError("Horizons autorisés : 7 ou 30 jours.")
    Company.objects.select_for_update().get(pk=company.pk)
    member, codes = context(company, membership)
    rules = allowed_rules(codes)
    if not rules:
        raise PermissionDenied("Aucune source ERP autorisée pour cette analyse.")
    key, fingerprint = request_identity(key, dict(actor=member.user_id, rules=rules, horizon=horizon, granularity=granularity))
    receipt = IdempotencyKey.objects.filter(company=company, operation="intelligence_refresh", key=key).first()
    if receipt:
        if receipt.actor_id != member.user_id or receipt.request_hash != fingerprint:
            raise BusinessConflict("Clé déjà utilisée pour une autre analyse.")
        return IntelligenceRun.objects.get(company=company, requested_by_id=member.user_id, pk=receipt.response_body["run_id"])
    expire_runs(IntelligenceRun.objects.filter(company=company))
    running = IntelligenceRun.objects.filter(company=company, status__in=["pending", "running"]).first()
    if running and running.requested_by_id != member.user_id:
        raise BusinessConflict("Une analyse est déjà en cours pour cette société.")
    if running and (running.rules != rules or running.horizon != horizon or running.granularity != granularity):
        raise BusinessConflict("Une analyse avec un autre périmètre est en cours.")
    run = running or IntelligenceRun.objects.create(company=company, requested_by_id=member.user_id, rules=rules, horizon=horizon, granularity=granularity, lease_expires_at=timezone.now()+timedelta(days=1))
    IdempotencyKey.objects.create(company=company, actor_id=member.user_id, operation="intelligence_refresh", key=key, request_hash=fingerprint,
        response_code=202, response_body=dict(run_id=run.pk), expires_at=timezone.now()+timedelta(days=30))
    if running is None:
        audit_run(run, "refresh_requested", member)
        from .tasks import run_company_intelligence
        enqueue_after_commit(run_company_intelligence, run.pk, failed=lambda: fail_run(run.pk, "broker_unavailable"))
    return run


@transaction.atomic
def claim_run(run_id):
    company_id = IntelligenceRun.objects.filter(pk=run_id).values_list("company_id", flat=True).first()
    if company_id is None:
        return None, dict(status="invalid")
    Company.objects.select_for_update().get(pk=company_id)
    run = IntelligenceRun.objects.select_for_update(of=("self",)).select_related("company").get(pk=run_id)
    if run.status != "pending":
        return None, dict(id=run.pk, status=run.status)
    if run.lease_expires_at < timezone.now():
        fail_run(run.pk, "execution_expired")
        return None, dict(id=run.pk, status="failed")
    try:
        member = run_actor(run)
    except PermissionDenied:
        fail_run(run.pk, "access_revoked")
        return None, dict(id=run.pk, status="failed")
    run.status, run.started_at, run.claim_token = "running", timezone.now(), uuid4()
    run.lease_expires_at = timezone.now()+RUN_LEASE
    run.save(update_fields=["status", "started_at", "claim_token", "lease_expires_at"])
    audit_run(run, "started", member)
    return run, None


def notify_critical(alert):
    from apps.notifications.selectors import recipient_memberships
    from apps.notifications.services import create_notification
    from apps.inventory.models import CompanyInventorySetting
    if alert.alert_type == "low_stock" and CompanyInventorySetting.objects.filter(company=alert.company, low_stock_alerts=False).exists():
        return
    permissions = {"ai.use", *RULE_PERMISSIONS[alert.alert_type]}
    for member in recipient_memberships(alert.company, permissions).iterator(chunk_size=100):
        create_notification(company=alert.company, recipient_id=member.user_id, type="critical_ai_alert", title=alert.title,
            message=alert.message, entity_type="aialert", entity_id=alert.pk, dedupe_key=f"ai_critical:{alert.pk}",
            permissions=permissions, send_email=False)


@transaction.atomic
def publish_signals(run, signals, analytics=None):
    Company.objects.select_for_update().get(pk=run.company_id)
    current = IntelligenceRun.objects.select_for_update().get(pk=run.pk)
    if current.status != "running" or current.claim_token != run.claim_token or current.lease_expires_at < timezone.now():
        raise BusinessConflict("Analyse expirée.")
    member = run_actor(current)
    now, created, updated = timezone.now(), 0, 0
    from django.db.models import Q
    period = (analytics or {}).get("anomalies", {}).get("period")
    scan_day = date.fromisoformat(period) if period else company_today(run.company)-timedelta(days=1)
    existing = {obj.fingerprint: obj for obj in AIAlert.objects.filter(company=run.company, alert_type__in=run.rules).filter(
        (Q(condition_active=True) & ~Q(source="statistical")) | Q(source="statistical", period_date=scan_day))}
    for data in signals:
        obj = existing.pop(data["fingerprint"], None)
        new = obj is None
        was_critical = obj is not None and obj.severity == "critical"
        if new:
            obj = AIAlert(company=run.company)
        for field, value in data.items():
            setattr(obj, field, value)
        obj.condition_active = True
        obj.last_seen_at = now
        obj.save()
        created += int(new)
        updated += int(not new)
        if obj.severity == "critical" and obj.status in ACTIVE and (new or not was_critical):
            notify_critical(obj)
    closed = 0
    for obj in existing.values():
        # Historical observations do not disappear just because the scan advances.
        if obj.source == "statistical" and obj.period_date != scan_day:
            continue
        obj.condition_active = False
        if obj.status in ACTIVE:
            obj.status, obj.resolved_at = "resolved", now
            closed += 1
            record_audit_event(company=run.company, actor=None, action="intelligence.alert_auto_resolved", entity=obj, metadata=dict(status=obj.status, run_id=run.pk))
        obj.save(update_fields=["condition_active", "status", "resolved_at", "updated_at"])
    current.status, current.completed_at, current.claim_token = "completed", now, None
    current.summary = dict(detected=len(signals), created=created, updated=updated, autoResolved=closed)
    if analytics is not None:
        for result in analytics["forecasts"]:
            metrics = result["metrics"] or {}
            ForecastRun.objects.create(company=run.company, intelligence_run=current, metric=result["metric"], status=result["status"],
                model_name=result["model"] or "", version=result["version"], granularity=result["granularity"], horizon=result["horizon"],
                training_start=result.get("trainingStart"), training_end=result.get("trainingEnd"), mae=metrics.get("mae"), rmse=metrics.get("rmse"), result=result)
        current.summary.update(version=ANALYTICS_VERSION, health=analytics["health"], anomalies=analytics["anomalies"],
            forecasts=[dict(metric=r["metric"], status=r["status"], model=r["model"]) for r in analytics["forecasts"]])
        if "expense_spike" in run.rules:
            audit_run(current, "anomalies_executed", member)
    if analytics is not None and "opportunities" in analytics:
        kinds = [rule.split(":", 1)[1] for rule in run.rules if rule.startswith("opportunity:")]
        current.summary["opportunities"] = publish_opportunities(current, analytics["opportunities"], kinds)
    current.save(update_fields=["status", "completed_at", "claim_token", "summary"])
    audit_run(current, "completed", member)
    return dict(id=current.pk, status=current.status)


def execute_run(run_id):
    if type(run_id) is not int or run_id < 1:
        return dict(status="invalid")
    run, result = claim_run(run_id)
    if run is None:
        return result
    stage, started = "rules", monotonic()
    try:
        signals = collect_signals(run.company, run.rules)
        day = company_today(run.company)-timedelta(days=1)
        from .health import business_health
        health_codes = {"ai.use"}.union(*(RULE_PERMISSIONS[rule] for rule in run.rules if rule in RULE_PERMISSIONS))
        analytics = dict(health=dict(status=business_health(run.company, health_codes)["status"]), anomalies=dict(status="not_authorized"), forecasts=[])
        if "expense_spike" in run.rules:
            stage = "anomalies"
            detected, analytics["anomalies"] = expense_spike(run.company, day)
            signals.extend(detected)
            if len(signals) > MAX_SIGNALS:
                raise ValidationError("Limite de détection dépassée ; aucun résultat partiel publié.")
            logger.info("intelligence_anomalies company_id=%s run_id=%s detector=activity_day_iqr observations=%s results=%s status=%s", run.company_id, run.pk, analytics["anomalies"]["observations"], len(detected), analytics["anomalies"]["status"])
        stage = "forecasts"
        for rule in run.rules:
            if rule.startswith("forecast:"):
                result = generate_forecast(run.company, rule.split(":", 1)[1], day, run.horizon, run.granularity)
                analytics["forecasts"].append(result)
                logger.info("intelligence_forecast company_id=%s run_id=%s metric=%s model=%s status=%s history_days=%s", run.company_id, run.pk, result["metric"], result["model"], result["status"], result["historyDays"])
        stage = "opportunities"
        kinds = [rule.split(":", 1)[1] for rule in run.rules if rule.startswith("opportunity:")]
        if kinds:
            analytics["opportunities"] = detect_company_opportunities(company=run.company, kinds=kinds, as_of=day+timedelta(days=1))
        stage = "publish"
        published = publish_signals(run, signals, analytics)
        logger.info("intelligence_completed company_id=%s run_id=%s duration_ms=%s signals=%s forecasts=%s version=%s", run.company_id, run.pk, round((monotonic()-started)*1000), len(signals), len(analytics["forecasts"]), ANALYTICS_VERSION)
        return published
    except Exception as error:
        code = "access_revoked" if isinstance(error, PermissionDenied) else "detection_limit" if isinstance(error, ValidationError) else "forecast_failed" if stage == "forecasts" else "analysis_failed"
        fail_run(run.pk, code, token=run.claim_token)
        logger.error("intelligence_failed company_id=%s run_id=%s stage=%s error_type=%s", run.company_id, run.pk, stage, type(error).__name__)
        return dict(id=run.pk, status="failed")


@transaction.atomic
def transition_alert(*, company, membership, alert_id, action):
    Company.objects.select_for_update().get(pk=company.pk)
    member, codes = context(company, membership)
    obj = alert_queryset(company, codes).select_for_update(of=("self",)).filter(pk=alert_id).first()
    if obj is None:
        raise NotFound()
    target = {"acknowledge": "acknowledged", "resolve": "resolved", "dismiss": "dismissed"}.get(action)
    if target is None:
        raise NotFound()
    if obj.status == target:
        return obj
    if obj.status not in ACTIVE or (action == "acknowledge" and obj.status != "open"):
        raise BusinessConflict("Transition d’alerte interdite.")
    previous, obj.status = obj.status, target
    prefix = {"acknowledge": "acknowledged", "resolve": "resolved", "dismiss": "dismissed"}[action]
    setattr(obj, f"{prefix}_at", timezone.now())
    setattr(obj, f"{prefix}_by_id", member.user_id)
    obj.save(update_fields=["status", f"{prefix}_at", f"{prefix}_by", "updated_at"])
    record_audit_event(company=company, actor=member, action=f"intelligence.alert_{target}", entity=obj,
        before=dict(status=previous), after=dict(status=target))
    return obj
