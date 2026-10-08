"""Short PostgreSQL claims; SMTP outside transactions; conservative retry policy."""
from datetime import timedelta
import logging
import smtplib
from uuid import uuid4
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import EmailMessage, get_connection
from django.core.validators import validate_email
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from apps.accounts.models import Membership
from apps.accounts.selectors import get_effective_permission_codes
from common.dates import company_today

logger = logging.getLogger(__name__)


class SkipDelivery(Exception):
    pass


def active_membership(company_id, user_id, permissions):
    member = Membership.objects.select_related("company", "user").filter(company_id=company_id, company__is_active=True, user_id=user_id, user__is_active=True, status="active").first()
    if member is None or not set(permissions).issubset(get_effective_permission_codes(membership=member)):
        raise SkipDelivery("recipient_inactive_or_access_revoked")
    return member


def reminder_message(reminder):
    from apps.sales.models import Invoice
    invoice = Invoice.objects.select_related("company", "customer").filter(pk=reminder.invoice_id, company_id=reminder.company_id, customer__company_id=reminder.company_id).first()
    if invoice is None:
        raise SkipDelivery("tenant_mismatch")
    company = invoice.company
    active_membership(company.pk, reminder.created_by_id, ["invoices.remind"])
    if invoice.status != "posted" or invoice.balance_due <= 0 or invoice.due_date >= company_today(company) or invoice.currency != company.currency:
        raise SkipDelivery("invoice_no_longer_overdue")
    if invoice.customer.status in {"blocked", "archived", "inactive"}:
        raise SkipDelivery("customer_inactive")
    configuration = getattr(company, "invoicing_setting", None)
    body = render_to_string("emails/invoice_reminder.txt", dict(invoice=invoice, company=company, footer=configuration.footer if configuration else ""))
    return invoice.customer.email, f"Relance facture {invoice.number}", body, company


def notification_message(notification):
    from apps.notifications.selectors import entity_exists
    if not entity_exists(notification):
        raise SkipDelivery("tenant_mismatch")
    member = active_membership(notification.company_id, notification.recipient_id, notification.required_permissions)
    if notification.type == "invoice_overdue":
        from apps.finance.summary_selectors import overdue_invoices
        if not overdue_invoices(member.company).filter(pk=notification.entity_id).exists():
            raise SkipDelivery("condition_resolved")
    if notification.type == "low_stock":
        from apps.inventory.selectors import low_stock_queryset
        if not low_stock_queryset(member.company, notification.warehouse).filter(pk=notification.entity_id).exists():
            raise SkipDelivery("condition_resolved")
    return member.user.email, notification.title, render_to_string("emails/notification.txt", dict(notification=notification, company=member.company)), member.company


def delivery_model(kind):
    from apps.sales.models import InvoiceReminder
    from apps.notifications.models import Notification
    return (InvoiceReminder, "status", "requested") if kind == "reminder" else (Notification, "email_status", "pending")


@transaction.atomic
def claim_delivery(kind, object_id):
    model, field, initial = delivery_model(kind)
    obj = model.objects.select_for_update().filter(pk=object_id).first()
    if obj is None:
        return None, dict(status="invalid", error="object_not_found")
    state = getattr(obj, field)
    if state not in {initial, "retrying"}:
        return None, dict(id=obj.pk, status=state)
    if obj.email_attempts >= 4:
        model.objects.filter(pk=obj.pk).update(**{field: "failed", "email_error_code": "retry_exhausted"})
        return None, dict(id=obj.pk, status="failed")
    setattr(obj, field, "processing")
    obj.email_started_at, obj.email_claim = timezone.now(), uuid4()
    obj.email_attempts += 1
    obj.save(update_fields=[field, "email_started_at", "email_claim", "email_attempts"])
    return obj, None


def finish_delivery(kind, obj, status, code="", recipient=None):
    model, field, _ = delivery_model(kind)
    values = {field: status, "email_error_code": code, "email_claim": None}
    if status == "sent":
        values["email_sent_at"] = timezone.now()
        if kind == "reminder":
            values["recipient"] = recipient
    changed = model.objects.filter(pk=obj.pk, email_claim=obj.email_claim, **{field: "processing"}).update(**values)
    if not changed:
        current = model.objects.filter(pk=obj.pk).values(field, "email_error_code").first()
        return dict(id=obj.pk, status=current[field] if current else "invalid", code=current["email_error_code"] if current else "object_not_found")
    logger.info("email_delivery_finished kind=%s company_id=%s object_id=%s status=%s code=%s", kind, obj.company_id, obj.pk, status, code)
    return dict(id=obj.pk, status=status, code=code)


def send_delivery(task, kind, object_id):
    if type(object_id) is not int or object_id < 1:
        return dict(status="invalid", error="invalid_id")
    obj, result = claim_delivery(kind, object_id)
    if obj is None:
        return result
    logger.info("email_delivery_started kind=%s company_id=%s object_id=%s", kind, obj.company_id, obj.pk)
    connection, submitting = None, False
    try:
        # Validate ownership/state even when outbound delivery is disabled.
        recipient, subject, body, company = reminder_message(obj) if kind == "reminder" else notification_message(obj)
        if not settings.EMAIL_DELIVERY_ENABLED:
            raise SkipDelivery("email_disabled")
        allowed = settings.EMAIL_BACKEND == "django.core.mail.backends.smtp.EmailBackend" or (settings.EMAIL_DELIVERY_TEST_MODE and settings.EMAIL_BACKEND == "django.core.mail.backends.locmem.EmailBackend")
        if not allowed:
            raise SkipDelivery("unsupported_email_backend")
        validate_email(recipient)
        validate_email(settings.DEFAULT_FROM_EMAIL)
        connection = get_connection(fail_silently=False)
        connection.open()  # A failure here is safe to retry: no message submitted.
        message = EmailMessage(subject=" ".join(subject.split()), body=body, from_email=settings.DEFAULT_FROM_EMAIL, to=[recipient], connection=connection)
        submitting = True
        accepted = connection.send_messages([message])
        if accepted != 1:
            return finish_delivery(kind, obj, "failed", "not_accepted")
        return finish_delivery(kind, obj, "sent", recipient=recipient)
    except SkipDelivery as error:
        return finish_delivery(kind, obj, "skipped", str(error))
    except DjangoValidationError:
        return finish_delivery(kind, obj, "failed", "invalid_email_address")
    except (OSError, smtplib.SMTPException) as error:
        # Never retry an ambiguous disconnect during SMTP DATA submission.
        explicit_temporary = isinstance(error, smtplib.SMTPResponseException) and 400 <= error.smtp_code < 500 and not isinstance(error, smtplib.SMTPAuthenticationError)
        disconnected = isinstance(error, smtplib.SMTPServerDisconnected) or (isinstance(error, OSError) and not isinstance(error, smtplib.SMTPException))
        before_submission = not submitting and disconnected
        if (explicit_temporary or before_submission) and task.request.retries < task.max_retries and obj.email_attempts < 4:
            result = finish_delivery(kind, obj, "retrying", "temporary_mail_error")
            if result["status"] == "retrying":
                raise task.retry(countdown=60*(2**task.request.retries))
            return result
        ambiguous = submitting and disconnected
        return finish_delivery(kind, obj, "uncertain" if ambiguous else "failed", "delivery_unknown" if ambiguous else "mail_rejected_or_unavailable")
    except Exception as error:
        # A programming/template/config error is terminal, never autoretried.
        logger.error("email_delivery_failed kind=%s company_id=%s object_id=%s error_type=%s", kind, obj.company_id, obj.pk, type(error).__name__)
        return finish_delivery(kind, obj, "uncertain" if submitting else "failed", "delivery_unknown" if submitting else "mail_configuration_error")
    finally:
        if connection:
            try:
                connection.close()
            except (OSError, smtplib.SMTPException):
                pass


def expire_email_claims():
    count = 0
    for kind in ["reminder", "notification"]:
        model, field, _ = delivery_model(kind)
        count += model.objects.filter(**{field: "processing", "email_started_at__lt": timezone.now()-timedelta(minutes=15)}).update(**{field: "uncertain", "email_error_code": "worker_interrupted", "email_claim": None})
        count += model.objects.filter(**{field: "retrying", "email_started_at__lt": timezone.now()-timedelta(days=1)}).update(**{field: "failed", "email_error_code": "retry_expired", "email_claim": None})
    return count
