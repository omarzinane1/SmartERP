from datetime import timedelta
import smtplib
from unittest.mock import Mock, patch
from celery.exceptions import Retry
from django.core import mail
from django.db import transaction
from django.test import TestCase, override_settings
from django.utils import timezone
from kombu.exceptions import OperationalError
from apps.accounts.models import RolePermission
from apps.finance.models import Expense
from apps.approvals.models import ApprovalRequest
from apps.finance.tasks import scan_overdue_invoices
from apps.notifications.models import Notification, BusinessEmail
from apps.notifications.tasks import send_notification_email
from apps.sales.models import Invoice, InvoiceReminder
from apps.sales.invoice_workflows import request_reminder
from apps.sales.tasks import send_invoice_reminder_email
from common.email_delivery import claim_delivery, expire_email_claims, finish_delivery
from common.tests.async_support import AsyncDataMixin


class EmailDeliveryTests(AsyncDataMixin, TestCase):
    def reminder(self):
        invoice = self.invoice(overdue=True)
        return request_reminder(company=self.company, membership=self.membership, invoice_id=invoice["id"], key=f"reminder-{invoice['id']}")

    def test_commit_reminder_email_reload_recipient_and_no_duplicate(self):
        invoice = self.invoice(overdue=True)
        with self.captureOnCommitCallbacks(execute=True):
            reminder = request_reminder(company=self.company, membership=self.membership, invoice_id=invoice["id"], key="reminder-flow-c")
            self.assertFalse(getattr(mail, "outbox", []))
            self.customer.email = "updated@example.test"
            self.customer.save()
        reminder.refresh_from_db()
        self.assertEqual((reminder.status, reminder.email_attempts), ("sent", 1))
        self.assertEqual(mail.outbox[0].to, ["updated@example.test"])
        self.assertIn(invoice["reference"], mail.outbox[0].body)
        send_invoice_reminder_email.run(reminder.pk)
        self.assertEqual(len(mail.outbox), 1)

    def test_rollback_discards_reminder_and_publication(self):
        invoice = self.invoice(overdue=True)
        with patch.object(send_invoice_reminder_email, "apply_async") as publish:
            with self.captureOnCommitCallbacks(execute=True):
                with self.assertRaises(RuntimeError), transaction.atomic():
                    request_reminder(company=self.company, membership=self.membership, invoice_id=invoice["id"], key="rolled-back-reminder")
                    raise RuntimeError("rollback")
            publish.assert_not_called()
        self.assertFalse(InvoiceReminder.objects.exists())

    def test_broker_down_does_not_undo_business_reminder(self):
        invoice = self.invoice(overdue=True)
        with patch.object(send_invoice_reminder_email, "apply_async", side_effect=OperationalError("broker down")):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.post(f"/api/invoices/{invoice['id']}/remind/", key="broker-down-reminder")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(InvoiceReminder.objects.get().email_error_code, "broker_unavailable")
        self.assertEqual(Invoice.objects.get(pk=invoice["id"]).balance_due, 1000)

    def test_missing_email_and_invalid_id_never_sent(self):
        reminder = self.reminder()
        self.customer.email = ""
        self.customer.save()
        self.assertEqual(send_invoice_reminder_email.run(reminder.pk)["status"], "failed")
        self.assertEqual(send_invoice_reminder_email.run(999999)["status"], "invalid")
        self.assertEqual(send_invoice_reminder_email.run("42")["status"], "invalid")
        self.assertFalse(getattr(mail, "outbox", []))

    @override_settings(EMAIL_DELIVERY_ENABLED=False)
    def test_disabled_delivery_is_skipped(self):
        reminder = self.reminder()
        result = send_invoice_reminder_email.run(reminder.pk)
        self.assertEqual((result["status"], result["code"]), ("skipped", "email_disabled"))
        self.assertFalse(getattr(mail, "outbox", []))

    def test_paid_foreign_and_revoked_reminders_are_skipped(self):
        paid, foreign, revoked = [self.reminder() for _ in range(3)]
        self.payment({"id": paid.invoice_id}, amount="1000.00")
        self.assertEqual(send_invoice_reminder_email.run(paid.pk)["code"], "invoice_no_longer_overdue")
        Invoice.objects.filter(pk=foreign.invoice_id).update(customer=self.foreign_customer)
        self.assertEqual(send_invoice_reminder_email.run(foreign.pk)["code"], "tenant_mismatch")
        RolePermission.objects.filter(role=self.role, permission__code="invoices.remind").delete()
        self.assertEqual(send_invoice_reminder_email.run(revoked.pk)["code"], "recipient_inactive_or_access_revoked")
        self.assertFalse(getattr(mail, "outbox", []))

    def test_connection_timeout_retries_then_success_once(self):
        reminder, connection = self.reminder(), Mock()
        connection.open.side_effect = TimeoutError("not submitted")
        with patch("common.email_delivery.get_connection", return_value=connection), patch.object(send_invoice_reminder_email, "retry", side_effect=Retry()) as retry:
            with self.assertRaises(Retry):
                send_invoice_reminder_email.run(reminder.pk)
            retry.assert_called_once_with(countdown=60)
        self.assertEqual(InvoiceReminder.objects.get(pk=reminder.pk).status, "retrying")
        self.assertEqual(send_invoice_reminder_email.run(reminder.pk)["status"], "sent")
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(InvoiceReminder.objects.get(pk=reminder.pk).email_attempts, 2)

    def test_ambiguous_submission_never_automatically_retried(self):
        reminder, connection = self.reminder(), Mock()
        connection.send_messages.side_effect = smtplib.SMTPServerDisconnected("unknown receipt")
        with patch("common.email_delivery.get_connection", return_value=connection), patch.object(send_invoice_reminder_email, "retry") as retry:
            self.assertEqual(send_invoice_reminder_email.run(reminder.pk)["status"], "uncertain")
            retry.assert_not_called()
        self.assertEqual(send_invoice_reminder_email.run(reminder.pk)["status"], "uncertain")
        self.assertFalse(getattr(mail, "outbox", []))

    def test_smtp_permanent_auth_error_is_not_retried(self):
        reminder, connection = self.reminder(), Mock()
        connection.open.side_effect = smtplib.SMTPAuthenticationError(535, b"bad credentials")
        with patch("common.email_delivery.get_connection", return_value=connection), patch.object(send_invoice_reminder_email, "retry") as retry:
            self.assertEqual(send_invoice_reminder_email.run(reminder.pk)["status"], "failed")
            retry.assert_not_called()

    def test_interrupted_claim_is_uncertain_and_fences_late_worker(self):
        reminder = self.reminder()
        claimed, _ = claim_delivery("reminder", reminder.pk)
        BusinessEmail.objects.filter(reminder=reminder).update(email_started_at=timezone.now()-timedelta(hours=1))
        self.assertEqual(expire_email_claims(), 1)
        self.assertEqual(finish_delivery("reminder", claimed, "sent", recipient=self.customer.email)["status"], "uncertain")
        reminder.refresh_from_db()
        self.assertIsNone(reminder.email_sent_at)

    def test_notification_email_recipient_dedup_and_resolved_condition(self):
        self.invoice(overdue=True)
        scan_overdue_invoices.run()
        notification = Notification.objects.get()
        self.assertEqual(send_notification_email.run(notification.pk)["status"], "sent")
        self.assertEqual(mail.outbox[0].to, [self.user.email])
        send_notification_email.run(notification.pk)
        self.assertEqual(len(mail.outbox), 1)
        late = self.invoice(overdue=True)
        scan_overdue_invoices.run()
        second = Notification.objects.get(entity_id=late["id"])
        self.payment(late, amount="1000.00")
        self.assertEqual(send_notification_email.run(second.pk)["code"], "condition_resolved")
        self.assertEqual(send_notification_email.run(999999)["status"], "invalid")

    def test_approval_stays_synchronous_and_email_published_after_commit(self):
        expense = self.expense(submitted=True)
        approval = ApprovalRequest.objects.get(expense_id=expense["id"])
        with patch.object(send_notification_email, "apply_async") as publish:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.post(f"/api/approvals/{approval.pk}/approve/", dict(version=approval.version, comment="Validé"))
                self.assertEqual(response.status_code, 200, response.data)
                self.assertEqual(Expense.objects.get(pk=expense["id"]).status, "approved")
                publish.assert_not_called()
            publish.assert_called_once_with(args=[Notification.objects.get(type="approval_approved").pk], retry=False)
