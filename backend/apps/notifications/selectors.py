from django.apps import apps
from django.db.models import Q
from apps.accounts.models import Membership
from apps.accounts.selectors import get_effective_permission_codes
from .models import Notification

ENTITY_MODELS = {"invoice": "sales.Invoice", "product": "inventory.Product", "approval": "approvals.ApprovalRequest", "job": "reporting.AsyncJob"}
ENTITY_MODELS["aialert"] = "intelligence.AIAlert"


def entity_queryset(kind, company_id, recipient_id):
    query = apps.get_model(ENTITY_MODELS[kind]).objects.filter(company_id=company_id)
    if kind == "invoice":
        query = query.filter(customer__company_id=company_id)
    elif kind == "approval":
        query = query.filter(Q(expense__company_id=company_id) | Q(purchase_order__company_id=company_id, purchase_order__supplier__company_id=company_id))
    elif kind == "product":
        query = query.filter(Q(category__isnull=True) | Q(category__company_id=company_id)).filter(Q(unit__isnull=True) | Q(unit__company_id=company_id)).filter(Q(supplier__isnull=True) | Q(supplier__company_id=company_id))
    elif kind == "job":
        query = query.filter(requested_by_id=recipient_id)
    elif kind == "aialert":
        # Reuse the source relation checks, including corrupted foreign FKs.
        from apps.intelligence.selectors import alert_queryset
        from apps.companies.models import Company
        member = Membership.objects.filter(company_id=company_id, user_id=recipient_id, status="active", user__is_active=True).first()
        codes = get_effective_permission_codes(membership=member)
        query = alert_queryset(Company.objects.get(pk=company_id), codes)
    return query


def recipient_memberships(company, permissions):
    query = Membership.objects.filter(company=company, company__is_active=True, status="active", user__is_active=True)
    for code in permissions:
        query = query.filter(membership_roles__role__company=company, membership_roles__role__is_active=True,
            membership_roles__role__role_permissions__permission__code=code, membership_roles__role__role_permissions__permission__is_active=True)
    return query.select_related("user", "company").distinct()


def entity_exists(notification):
    model = ENTITY_MODELS.get(notification.entity_type)
    if not model:
        return False
    query = entity_queryset(notification.entity_type, notification.company_id, notification.recipient_id).filter(pk=notification.entity_id)
    if notification.warehouse_id and notification.warehouse.company_id != notification.company_id:
        return False
    return query.exists()


def notification_queryset(company, membership):
    if membership is None or membership.company_id != company.pk or membership.status != "active" or not company.is_active or not membership.user.is_active:
        return Notification.objects.none()
    codes = get_effective_permission_codes(membership=membership)
    query = Notification.objects.filter(company=company, recipient_id=membership.user_id, required_permissions__contained_by=codes)
    entities = Q(pk__in=[])
    for kind in ENTITY_MODELS:
        records = entity_queryset(kind, company.pk, membership.user_id)
        entities |= Q(entity_type=kind, entity_id__in=records.values("pk"))
    return query.filter(entities).filter(Q(warehouse__isnull=True) | Q(warehouse__company=company))


def notification_payload(obj):
    path = {"invoice": f"/invoices/{obj.entity_id}", "product": f"/products/{obj.entity_id}", "approval": "/approvals", "job": "/reports"}.get(obj.entity_type)
    if obj.entity_type == "aialert":
        path = "/ai/control-center"
    return dict(id=obj.pk, type=obj.type, title=obj.title, message=obj.message, entityType=obj.entity_type, entityId=obj.entity_id, path=path,
        isRead=obj.is_read, readAt=obj.read_at, createdAt=obj.created_at, emailStatus=obj.email_status)
