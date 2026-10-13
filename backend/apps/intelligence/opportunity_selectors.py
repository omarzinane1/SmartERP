from zoneinfo import ZoneInfo
from django.db.models import Case, CharField, F, Q, Value, When
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from apps.inventory.selectors import product_queryset
from .models import AIOpportunity
from .opportunity_detectors import customers
from . import opportunity_config as policy

METRICS = {
    "customer_reactivation": "orders_count days_inactive last_order historical_orders_ht from_date to_date",
    "high_value_customer": "revenue_ht percentile_75 customers_count invoices_count last_invoice from_date to_date",
    "receivable_collection": "overdue_amount company_overdue invoices_count oldest_due age_days",
    "stock_replenishment": "available minimum historical_issues activity_days review_quantity warehouse from_date to_date",
    "dormant_stock": "quantity inventory_value last_movement inactivity_days warehouse",
}


def require_opportunities(codes):
    if not {"ai.use", "ai.opportunities.view"}.issubset(codes):
        raise PermissionDenied()


def opportunity_queryset(company, codes):
    entities = Q(pk__in=[])
    for kind in policy.allowed_types(codes):
        if policy.DOMAINS[kind] == "inventory":
            entities |= Q(opportunity_type=kind, entity_type="product", entity_id__in=product_queryset(company).values("pk"), warehouse__company=company)
        else:
            entities |= Q(opportunity_type=kind, entity_type="customer", entity_id__in=customers(company).values("pk"), warehouse__isnull=True)
    return AIOpportunity.objects.filter(company=company).filter(entities).annotate(
        effective_status=Case(When(status__in=policy.ACTIVE, expires_at__lte=timezone.now(), then=Value("expired")), default=F("status"), output_field=CharField()),
        priority_rank=Case(When(priority="critical", then=Value(0)), When(priority="high", then=Value(1)), When(priority="medium", then=Value(2)), default=Value(3)),
    ).order_by("priority_rank", "-detected_at", "-pk")


def filtered_opportunities(query, filters, company):
    for key, field in [("type", "opportunity_type"), ("status", "effective_status"), ("priority", "priority"), ("domain", "domain")]:
        if filters.get(key):
            query = query.filter(**{field: filters[key]})
    if filters.get("search"):
        query = query.filter(Q(title__icontains=filters["search"]) | Q(reason__icontains=filters["search"]))
    if filters.get("date_from") or filters.get("date_to"):
        query = query.annotate(local_day=TruncDate("detected_at", tzinfo=ZoneInfo(company.timezone)))
        for key, lookup in [("date_from", "gte"), ("date_to", "lte")]:
            if filters.get(key):
                query = query.filter(**{f"local_day__{lookup}": filters[key]})
    return query


def opportunity_payload(obj):
    status = "expired" if obj.status in policy.ACTIVE and obj.expires_at <= timezone.now() else obj.status
    metrics = obj.metadata.get("metrics", {})
    metrics = {k: v for k, v in metrics.items() if k in METRICS[obj.opportunity_type].split() and type(v) in (str, int)} if isinstance(metrics, dict) else {}
    name = obj.metadata.get("entity_name", "")
    name = name[:180] if isinstance(name, str) else ""
    path = f"/{'customers' if obj.entity_type == 'customer' else 'products'}/{obj.entity_id}"
    value_kind = {"receivable_collection": "outstanding_receivable", "dormant_stock": "book_inventory_value"}.get(obj.opportunity_type)
    return dict(id=obj.pk, type=obj.opportunity_type, domain=obj.domain, title=obj.title, description=obj.description,
        reason=obj.reason, recommendation=obj.description, priority=obj.priority, status=status,
        potentialValue=str(obj.estimated_value) if obj.estimated_value is not None else None, valueKind=value_kind, currency=obj.currency,
        confidence=None, source=obj.source, detector=obj.detector, version=obj.version, metrics=metrics,
        entity=dict(type=obj.entity_type, id=obj.entity_id, name=name, path=path),
        evidence=[dict(id=f"opportunity-{obj.pk}", documentId=None, documentName=name, page=None, section=None,
            excerpt=obj.reason, recordPath=path, period=None, authorized=True)],
        detectedAt=obj.detected_at, lastSeenAt=obj.last_seen_at, expiresAt=obj.expires_at,
        acknowledgedAt=obj.acknowledged_at, dismissedAt=obj.dismissed_at, completedAt=obj.completed_at,
        expiredAt=obj.expired_at or (obj.expires_at if status == "expired" else None),
        acknowledgedBy=obj.acknowledged_by_id, dismissedBy=obj.dismissed_by_id, completedBy=obj.completed_by_id,
        actions=(["acknowledge", "dismiss"] if status == "open" else ["complete", "dismiss"] if status == "acknowledged" else []))
