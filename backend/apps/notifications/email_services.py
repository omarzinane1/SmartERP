from datetime import timedelta
import logging
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError, NotFound, PermissionDenied
from apps.accounts.models import Membership
from apps.audit.models import IdempotencyKey
from apps.audit.services import record_audit_event
from apps.companies.models import Company
from common.dispatch import enqueue_after_commit
from common.email_delivery import SkipDelivery
from common.exceptions import BusinessConflict
from common.idempotency import request_identity
from .models import BusinessEmail
from .email_builders import business_context

logger = logging.getLogger(__name__)


def audit_email(email, action):
    member = Membership.objects.filter(company_id=email.company_id, user_id=email.requested_by_id).first() if email.requested_by_id else None
    record_audit_event(company=email.company, actor=member, action=f"email.{action}", entity_type=email.entity_type, entity_id=email.entity_id,
        metadata=dict(email_id=email.pk, email_type=email.email_type, status=email.status, backend=email.backend, error_code=email.email_error_code))


def sync_legacy(email):
    values = dict(email_attempts=email.email_attempts, email_started_at=email.email_started_at, email_sent_at=email.email_sent_at,
        email_error_code=email.email_error_code, email_claim=email.email_claim)
    state = "processing" if email.status == "sending" else email.status
    if email.reminder_id:
        from apps.sales.models import InvoiceReminder
        InvoiceReminder.objects.filter(pk=email.reminder_id, company_id=email.company_id).update(status="requested" if state == "pending" else state, recipient=email.recipient, **values)
    if email.notification_id:
        from .models import Notification
        Notification.objects.filter(pk=email.notification_id, company_id=email.company_id).update(email_status=state, **values)


@transaction.atomic
def publication_failed(email_id):
    email = BusinessEmail.objects.select_for_update().get(pk=email_id)
    if email.status != "pending":
        return
    email.status, email.email_error_code, email.error_message, email.failed_at = "failed", "broker_unavailable", "File d’envoi indisponible.", timezone.now()
    email.save(update_fields=["status", "email_error_code", "error_message", "failed_at"])
    sync_legacy(email)
    audit_email(email, "failed")


def publish_email_after_commit(email):
    if email.reminder_id:
        from apps.sales.tasks import send_invoice_reminder_email
        task, identifier = send_invoice_reminder_email, email.reminder_id
    elif email.notification_id:
        from .tasks import send_notification_email
        task, identifier = send_notification_email, email.notification_id
    else:
        from .tasks import send_business_email_task
        task, identifier = send_business_email_task, email.pk
    enqueue_after_commit(task, identifier, failed=lambda: publication_failed(email.pk))


@transaction.atomic
def prepare_email(*, company, email_type, entity_type, entity_id, dedupe_key, requested_by_id=None, notification=None, reminder=None, strict=True, publish=True):
    Company.objects.select_for_update().get(pk=company.pk)
    existing = BusinessEmail.objects.filter(company=company, dedupe_key=dedupe_key).first()
    if existing:
        if (existing.email_type, existing.entity_type, existing.entity_id, existing.notification_id, existing.reminder_id) != (email_type, entity_type, entity_id, notification.pk if notification else None, reminder.pk if reminder else None):
            raise BusinessConflict("Cette identité d’envoi appartient à un autre événement.")
        return existing
    email = BusinessEmail(company=company, email_type=email_type, entity_type=entity_type, entity_id=entity_id, dedupe_key=dedupe_key,
        requested_by_id=requested_by_id, notification=notification, reminder=reminder, recipient_user_id=notification.recipient_id if notification else None)
    try:
        email.recipient, email.subject, _, _ = business_context(email)
    except (ValidationError, NotFound, SkipDelivery) as error:
        if strict:
            if isinstance(error, SkipDelivery):
                if str(error) == "recipient_inactive_or_access_revoked":
                    raise PermissionDenied("Permission d’envoi ou de lecture manquante.") from error
                raise BusinessConflict("Ce document ne peut pas être envoyé dans son état actuel.") from error
            raise
        email.status, email.failed_at = "failed", timezone.now()
        email.email_error_code, email.error_message = "recipient_or_state_invalid", "Destinataire absent, accès révoqué ou événement devenu invalide."
    email.save()
    sync_legacy(email)
    audit_email(email, "queued" if email.status == "pending" else "failed")
    logger.info("business_email_prepared company_id=%s email_id=%s type=%s status=%s", company.pk, email.pk, email_type, email.status)
    if publish and email.status == "pending":
        publish_email_after_commit(email)
    return email


@transaction.atomic
def request_document_email(*, company, membership, entity, email_type, key=None, resend=False):
    Company.objects.select_for_update().get(pk=company.pk)
    if entity.company_id != company.pk or membership.company_id != company.pk:
        raise NotFound()
    entity_type = {"invoice": "invoice", "quote": "quote", "purchase_order": "purchaseorder", "payment_confirmation": "payment"}[email_type]
    fingerprint, receipt = None, None
    if key or resend:
        key, fingerprint = request_identity(key, dict(type=email_type, entity_id=entity.pk, resend=resend, actor=membership.user_id))
        receipt = IdempotencyKey.objects.filter(company=company, operation="business_email", key=key).first()
        if receipt:
            if receipt.actor_id != membership.user_id or receipt.request_hash != fingerprint:
                raise BusinessConflict("Clé déjà utilisée pour un autre envoi.")
            return BusinessEmail.objects.get(company=company, pk=receipt.response_body["email_id"])
    dedupe = f"{email_type}:resend:{key}" if resend else f"{email_type}:initial:{entity.pk}"
    # A new request must still be eligible even if its initial email already exists.
    try:
        business_context(BusinessEmail(company=company, email_type=email_type, entity_type=entity_type, entity_id=entity.pk, requested_by_id=membership.user_id))
    except SkipDelivery as error:
        if str(error) == "recipient_inactive_or_access_revoked":
            raise PermissionDenied("Permission d’envoi ou de lecture manquante.") from error
        raise BusinessConflict("Ce document ne peut pas être envoyé dans son état actuel.") from error
    email = prepare_email(company=company, email_type=email_type, entity_type=entity_type, entity_id=entity.pk,
        requested_by_id=membership.user_id, dedupe_key=dedupe)
    if key and not receipt:
        IdempotencyKey.objects.create(company=company, actor_id=membership.user_id, operation="business_email", key=key, request_hash=fingerprint,
            response_code=200, response_body=dict(email_id=email.pk), expires_at=timezone.now()+timedelta(days=30))
    return email


def prepare_reminder_email(reminder, *, publish=True):
    return prepare_email(company=reminder.company, email_type="invoice_reminder", entity_type="invoice", entity_id=reminder.invoice_id,
        requested_by_id=reminder.created_by_id, reminder=reminder, dedupe_key=f"reminder:{reminder.pk}", publish=publish)


def prepare_notification_email(notification, *, publish=True):
    kind = notification.type if notification.type in {"approval_requested", "approval_approved", "approval_rejected"} else "notification"
    return prepare_email(company=notification.company, email_type=kind, entity_type=notification.entity_type, entity_id=notification.entity_id,
        notification=notification, dedupe_key=f"notification:{notification.pk}", strict=False, publish=publish)


def email_payload(email):
    return dict(id=email.pk, type=email.email_type, status=email.status, recipient=email.recipient, subject=email.subject,
        createdAt=email.created_at, sentAt=email.email_sent_at, failedAt=email.failed_at, errorCode=email.email_error_code or None,
        errorMessage=email.error_message or None, retryCount=max(0, email.email_attempts-1), backend=email.backend or None)
