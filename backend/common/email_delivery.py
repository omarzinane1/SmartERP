"""PostgreSQL claims and SMTP transport; business builders live in notifications."""
from datetime import timedelta
from email.utils import formataddr, parseaddr
import logging
import smtplib
from uuid import uuid4
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import EmailMultiAlternatives, get_connection
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from apps.accounts.models import Membership
from apps.accounts.selectors import get_effective_permission_codes

logger = logging.getLogger(__name__)


class SkipDelivery(Exception):
    pass


def active_membership(company_id, user_id, permissions):
    member = Membership.objects.select_related("company", "user").filter(company_id=company_id, company__is_active=True, user_id=user_id, user__is_active=True, status="active").first()
    if member is None or not set(permissions).issubset(get_effective_permission_codes(membership=member)):
        raise SkipDelivery("recipient_inactive_or_access_revoked")
    return member


def delivery_queryset(kind, object_id):
    from apps.notifications.models import BusinessEmail
    field = {"business": "pk", "reminder": "reminder_id", "notification": "notification_id"}[kind]
    return BusinessEmail.objects.filter(**{field: object_id})


@transaction.atomic
def claim_delivery(kind, object_id):
    from apps.notifications.email_services import sync_legacy
    obj = delivery_queryset(kind, object_id).select_for_update().first()
    if obj is None:
        return None, dict(status="invalid", error="object_not_found")
    if obj.status not in {"pending", "retrying"}:
        return None, dict(id=obj.pk, status=obj.status)
    if obj.email_attempts >= 4:
        obj.status, obj.email_error_code, obj.failed_at = "failed", "retry_exhausted", timezone.now()
        obj.save(update_fields=["status", "email_error_code", "failed_at"])
        sync_legacy(obj)
        return None, dict(id=obj.pk, status="failed")
    obj.status, obj.email_started_at, obj.email_claim = "sending", timezone.now(), uuid4()
    obj.email_attempts += 1
    obj.save(update_fields=["status", "email_started_at", "email_claim", "email_attempts"])
    sync_legacy(obj)
    return obj, None


@transaction.atomic
def finish_delivery(kind, obj, status, code="", recipient=None):
    from apps.notifications.models import BusinessEmail
    from apps.notifications.email_services import sync_legacy, audit_email
    current = BusinessEmail.objects.select_for_update().filter(pk=obj.pk).first()
    if current is None:
        return dict(id=obj.pk, status="invalid", code="object_not_found")
    if current.email_claim != obj.email_claim or current.status != "sending":
        return dict(id=obj.pk, status=current.status, code=current.email_error_code)
    current.status, current.email_error_code, current.email_claim = status, code, None
    if status == "sent":
        current.email_sent_at, current.recipient = timezone.now(), recipient
    elif status in {"failed", "uncertain", "skipped"}:
        current.failed_at = timezone.now()
        current.error_message = "Résultat de l’envoi incertain : vérifiez avant tout renvoi." if status == "uncertain" else "Envoi impossible ou désactivé. Vérifiez le destinataire, l’état métier et la configuration."
    current.save()
    sync_legacy(current)
    if status != "retrying":
        audit_email(current, "sent" if status == "sent" else "failed")
    logger.info("email_delivery_finished type=%s company_id=%s email_id=%s status=%s code=%s", current.email_type, current.company_id, current.pk, status, code)
    return dict(id=current.pk, status=status, code=code)


def send_delivery(task, kind, object_id):
    if type(object_id) is not int or object_id < 1:
        return dict(status="invalid", error="invalid_id")
    obj, result = claim_delivery(kind, object_id)
    if obj is None:
        return result
    logger.info("email_delivery_started type=%s company_id=%s email_id=%s", obj.email_type, obj.company_id, obj.pk)
    connection, submitting, connecting = None, False, False
    try:
        from apps.notifications.email_builders import build_business_email
        data = build_business_email(obj, attachments=settings.EMAIL_DELIVERY_ENABLED)
        if not settings.EMAIL_DELIVERY_ENABLED:
            raise SkipDelivery("email_disabled")
        allowed = settings.EMAIL_BACKEND == "django.core.mail.backends.smtp.EmailBackend" or (settings.EMAIL_DELIVERY_TEST_MODE and settings.EMAIL_BACKEND == "django.core.mail.backends.locmem.EmailBackend") or (settings.EMAIL_ALLOW_CONSOLE and settings.EMAIL_BACKEND == "django.core.mail.backends.console.EmailBackend")
        if not allowed:
            raise SkipDelivery("unsupported_email_backend")
        _, sender = parseaddr(settings.DEFAULT_FROM_EMAIL)
        validate_email(sender)
        name = " ".join((obj.company.legal_name or obj.company.name).split())
        connection = get_connection(fail_silently=False)
        message = EmailMultiAlternatives(subject=data["subject"], body=data["body"], from_email=formataddr((name, sender)), to=[data["recipient"]], connection=connection)
        message.attach_alternative(data["html"], "text/html")
        for filename, content, mime in data["attachments"]:
            message.attach(" ".join(filename.split()), content, mime)
        from apps.notifications.models import BusinessEmail
        changed = BusinessEmail.objects.filter(pk=obj.pk, status="sending", email_claim=obj.email_claim).update(recipient=data["recipient"], subject=data["subject"], backend=settings.EMAIL_BACKEND)
        if not changed:
            raise SkipDelivery("claim_expired")
        connecting = True
        connection.open()
        connecting = False
        submitting = True
        if connection.send_messages([message]) != 1:
            return finish_delivery(kind, obj, "failed", "mail_not_accepted")
        return finish_delivery(kind, obj, "sent", recipient=data["recipient"])
    except SkipDelivery as error:
        return finish_delivery(kind, obj, "skipped", str(error))
    except (DjangoValidationError, ValidationError):
        return finish_delivery(kind, obj, "failed", "invalid_email_address")
    except (NotFound, PermissionDenied):
        return finish_delivery(kind, obj, "skipped", "tenant_mismatch")
    except (OSError, smtplib.SMTPException) as error:
        temporary = isinstance(error, smtplib.SMTPResponseException) and 400 <= error.smtp_code < 500 and not isinstance(error, smtplib.SMTPAuthenticationError)
        disconnected = isinstance(error, smtplib.SMTPServerDisconnected) or (isinstance(error, OSError) and not isinstance(error, smtplib.SMTPException))
        if (temporary or (connecting and disconnected)) and task.request.retries < task.max_retries and obj.email_attempts < 4:
            result = finish_delivery(kind, obj, "retrying", "temporary_mail_error")
            if result["status"] == "retrying":
                raise task.retry(countdown=60*(2**task.request.retries))
            return result
        ambiguous = submitting and disconnected
        return finish_delivery(kind, obj, "uncertain" if ambiguous else "failed", "delivery_unknown" if ambiguous else "mail_rejected_or_unavailable")
    except Exception as error:
        logger.error("email_delivery_failed company_id=%s email_id=%s error_type=%s", obj.company_id, obj.pk, type(error).__name__)
        return finish_delivery(kind, obj, "uncertain" if submitting else "failed", "delivery_unknown" if submitting else "mail_configuration_error")
    finally:
        if connection:
            try:
                connection.close()
            except (OSError, smtplib.SMTPException):
                pass


def expire_email_claims(query=None):
    from apps.notifications.models import BusinessEmail
    from apps.notifications.email_services import sync_legacy, audit_email
    now, count = timezone.now(), 0
    expired = Q(status="sending", email_started_at__lt=now-timedelta(minutes=15)) | Q(status="retrying", email_started_at__lt=now-timedelta(days=1)) | Q(status="pending", created_at__lt=now-timedelta(days=1))
    query = query if query is not None else BusinessEmail.objects.all()
    for pk in query.filter(expired).values_list("pk", flat=True).iterator(chunk_size=500):
        with transaction.atomic():
            obj = BusinessEmail.objects.select_for_update().filter(pk=pk).filter(expired).first()
            if obj is None:
                continue
            obj.status = "uncertain" if obj.status == "sending" else "failed"
            obj.email_error_code, obj.error_message = "worker_interrupted", "Worker interrompu ou indisponible ; vérifiez avant tout renvoi."
            obj.failed_at, obj.email_claim = now, None
            obj.save()
            sync_legacy(obj)
            audit_email(obj, "failed")
            count += 1
    return count
