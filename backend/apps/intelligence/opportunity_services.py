"""Supervision lifecycle only; company lock shared with IntelligenceRun publication."""
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound
from apps.audit.services import record_audit_event
from apps.companies.models import Company
from common.exceptions import BusinessConflict
from . import opportunity_config as policy
from .models import AIOpportunity
from .opportunity_detectors import bounded
from .opportunity_selectors import opportunity_queryset, require_opportunities


def publish_opportunities(run, candidates, kinds):
    # Called inside publish_signals' atomic transaction, after renewed authorization.
    now = timezone.now()
    existing = {obj.fingerprint: obj for obj in bounded(AIOpportunity.objects.filter(company=run.company,
        opportunity_type__in=kinds, condition_active=True).order_by("pk"))}
    counts = dict(detected=len(candidates), created=0, updated=0, expired=0, version=policy.VERSION)
    for data in candidates:
        obj = existing.pop(data["fingerprint"], None)
        counts["updated" if obj else "created"] += 1
        obj = obj or AIOpportunity(company=run.company)
        for key, value in data.items():
            setattr(obj, key, value)
        obj.last_seen_at, obj.expires_at = now, now+policy.TTL
        obj.save()
    for obj in existing.values():
        obj.condition_active = False
        if obj.status in policy.ACTIVE:
            obj.status, obj.expired_at = "expired", now
            counts["expired"] += 1
            record_audit_event(company=run.company, actor=None, action="intelligence.opportunity_expired", entity=obj,
                metadata=dict(status=obj.status, run_id=run.pk, version=policy.VERSION))
        obj.save(update_fields=["condition_active", "status", "expired_at", "updated_at"])
    return counts


@transaction.atomic
def transition_opportunity(*, company, membership, opportunity_id, action):
    from .selectors import context
    Company.objects.select_for_update().get(pk=company.pk)
    member, codes = context(company, membership)
    require_opportunities(codes)
    obj = opportunity_queryset(company, codes).select_for_update(of=("self",)).filter(pk=opportunity_id).first()
    if obj is None:
        raise NotFound()
    target = {"acknowledge": "acknowledged", "dismiss": "dismissed", "complete": "completed"}.get(action)
    if target is None:
        raise NotFound()
    if obj.effective_status == target:
        return obj
    allowed = {"acknowledge": ["open"], "dismiss": policy.ACTIVE, "complete": ["acknowledged"]}
    if obj.effective_status not in allowed[action]:
        raise BusinessConflict("Transition d'opportunité interdite ou opportunité expirée.")
    previous, obj.status = obj.status, target
    setattr(obj, f"{target}_at", timezone.now())
    setattr(obj, f"{target}_by_id", member.user_id)
    obj.save(update_fields=["status", f"{target}_at", f"{target}_by", "updated_at"])
    record_audit_event(company=company, actor=member, action=f"intelligence.opportunity_{target}", entity=obj,
        before=dict(status=previous), after=dict(status=target), metadata=dict(version=obj.version))
    return obj


def acknowledge_opportunity(**kwargs):
    return transition_opportunity(action="acknowledge", **kwargs)


def dismiss_opportunity(**kwargs):
    return transition_opportunity(action="dismiss", **kwargs)


def complete_opportunity(**kwargs):
    return transition_opportunity(action="complete", **kwargs)
