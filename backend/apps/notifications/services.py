from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError
from apps.companies.models import Company
from .models import Notification
from .selectors import entity_exists, notification_queryset, recipient_memberships


@transaction.atomic
def create_notification(*, company, recipient_id, type, title, message, entity_type, entity_id, dedupe_key, permissions, warehouse=None):
    Company.objects.select_for_update().get(pk=company.pk)
    if not recipient_memberships(company, permissions).filter(user_id=recipient_id).exists():
        return None, False
    candidate = Notification(company=company, recipient_id=recipient_id, entity_type=entity_type, entity_id=entity_id, warehouse=warehouse)
    if not entity_exists(candidate):
        raise ValidationError("Entité de notification incohérente.")
    obj, created = Notification.objects.get_or_create(company=company, recipient_id=recipient_id, dedupe_key=dedupe_key,
        defaults=dict(type=type, title=title, message=message, entity_type=entity_type, entity_id=entity_id, warehouse=warehouse, required_permissions=sorted(permissions)))
    if created:
        from .email_services import prepare_notification_email
        prepare_notification_email(obj)
    return obj, created


def mark_notification_read(*, company, membership, notification_id):
    query = notification_queryset(company, membership).filter(pk=notification_id)
    if not query.exists():
        raise NotFound()
    query.filter(is_read=False).update(is_read=True, read_at=timezone.now())
    return query.get()


def mark_all_notifications_read(*, company, membership):
    return notification_queryset(company, membership).filter(is_read=False).update(is_read=True, read_at=timezone.now())


def notify_approval_decision(*, company, approval):
    permissions = ["approvals.view", "expenses.view" if approval.expense_id else "purchases.view"]
    return create_notification(company=company, recipient_id=approval.requested_by_id, type=f"approval_{approval.status}", title="Approbation acceptée" if approval.status == "approved" else "Approbation refusée",
        message=f"{approval.number} : {approval.status}.", entity_type="approval", entity_id=approval.pk,
        dedupe_key=f"approval_decided:{approval.pk}", permissions=permissions)


def notify_approval_requested(*, company, approval):
    permissions = ["approvals.view", "approvals.approve", "expenses.view" if approval.expense_id else "purchases.view", "expenses.approve" if approval.expense_id else "purchases.confirm"]
    for member in recipient_memberships(company, permissions).iterator(chunk_size=100):
        create_notification(company=company, recipient_id=member.user_id, type="approval_requested", title="Approbation demandée",
            message=f"La demande {approval.number} attend votre décision.", entity_type="approval", entity_id=approval.pk,
            dedupe_key=f"approval_requested:{approval.pk}", permissions=permissions)
