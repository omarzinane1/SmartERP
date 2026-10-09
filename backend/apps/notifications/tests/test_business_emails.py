from io import BytesIO
import smtplib
from unittest.mock import Mock, patch
from celery.exceptions import Retry
from django.core import mail
from django.db import transaction
from django.test import TestCase, override_settings
from pypdf import PdfReader
from apps.accounts.models import User, Membership, Role, Permission, RolePermission, MembershipRole
from apps.approvals.models import ApprovalRequest
from apps.audit.models import AuditLog
from apps.finance.models import Payment, PaymentAllocation
from apps.notifications.models import BusinessEmail, Notification
from apps.notifications.tasks import send_business_email_task, send_notification_email
from apps.sales.models import Invoice, Quote, InvoiceReminder
from apps.purchasing.models import PurchaseOrder, Supplier
from common.tests.async_support import AsyncDataMixin


class BusinessEmailTests(AsyncDataMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        RolePermission.objects.get_or_create(role=cls.role, permission=Permission.objects.get(code="invoices.send"))

    def send_invoice(self, invoice=None, **body):
        invoice = invoice or self.invoice()
        response = self.post(f"/api/invoices/{invoice['id']}/send/", body)
        self.assertEqual(response.status_code, 200, response.data)
        return BusinessEmail.objects.filter(email_type="invoice", entity_id=invoice["id"]).first()

    def test_invoice_html_text_pdf_branding_and_audit(self):
        invoice = self.invoice(price="19.99", quantity="3.000", tax="20.00")
        with self.captureOnCommitCallbacks(execute=True):
            email = self.send_invoice(invoice)
            self.assertEqual(email.status, "pending")
            self.assertFalse(getattr(mail, "outbox", []))
        email.refresh_from_db()
        self.assertEqual(email.status, "sent")
        self.assertIsNotNone(email.email_sent_at)
        message = mail.outbox[0]
        self.assertEqual(message.to, [self.customer.email])
        self.assertIn(self.company.name, message.from_email)
        self.assertIn("erp@example.test", message.from_email)
        self.assertIn(invoice["reference"], message.subject)
        self.assertIn(self.company.name, message.body)
        self.assertIn("text/html", [item.mimetype for item in message.alternatives])
        attachment = message.attachments[0]
        self.assertEqual(attachment.mimetype, "application/pdf")
        text = "\n".join(page.extract_text() for page in PdfReader(BytesIO(attachment.content)).pages)
        self.assertIn("71.96", text)
        self.assertNotIn("Foreign", text)
        self.assertEqual(set(AuditLog.objects.filter(action__startswith="email.").values_list("action", flat=True)), {"email.queued", "email.sent"})
        audit = AuditLog.objects.get(action="email.sent")
        self.assertEqual(audit.metadata["email_id"], email.pk)
        self.assertNotIn("@", str(audit.metadata))
        self.assertNotIn("<html", str(audit.metadata))
        send_business_email_task.run(email.pk)
        self.assertEqual(len(mail.outbox), 1)

    def test_invoice_duplicate_click_and_explicit_resend(self):
        invoice = self.invoice()
        path = f"/api/invoices/{invoice['id']}/send/"
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.post(path, key="first-send-key").status_code, 200)
            self.assertEqual(self.post(path, key="first-send-key").status_code, 200)
            self.assertEqual(self.post(path).status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.post(path, dict(resend=True), key="intentional-resend").status_code, 200)
            self.assertEqual(self.post(path, dict(resend=True), key="intentional-resend").status_code, 200)
        self.assertEqual(len(mail.outbox), 2)
        self.assertEqual(BusinessEmail.objects.count(), 2)
        self.assertEqual(self.client.post(path, dict(resend=True), format="json").status_code, 400)
        self.assertEqual(self.post(path, dict(resend=False), key="intentional-resend").status_code, 409)
        # Even after registry retention, the durable email identity cannot target another document.
        from apps.audit.models import IdempotencyKey
        IdempotencyKey.objects.filter(operation="business_email", key="intentional-resend").delete()
        another = self.invoice()
        self.assertEqual(self.post(f"/api/invoices/{another['id']}/send/", dict(resend=True), key="intentional-resend").status_code, 409)
        self.assertEqual(BusinessEmail.objects.count(), 2)

    def test_missing_address_invalid_state_and_foreign_entity_rejected_before_queue(self):
        invoice = self.invoice()
        draft = self.invoice(posted=False)
        self.assertEqual(self.post(f"/api/invoices/{draft['id']}/send/").status_code, 409)
        self.customer.email = ""
        self.customer.save()
        with patch.object(send_business_email_task, "apply_async") as publish:
            with self.captureOnCommitCallbacks(execute=True):
                self.assertEqual(self.post(f"/api/invoices/{invoice['id']}/send/").status_code, 400)
            publish.assert_not_called()
        self.assertFalse(BusinessEmail.objects.exists())
        Invoice.objects.filter(pk=invoice["id"]).update(company=self.other_company, customer=self.foreign_customer)
        self.assertEqual(self.post(f"/api/invoices/{invoice['id']}/send/").status_code, 404)

    def test_worker_checks_changed_customer_and_revoked_permission(self):
        first = self.send_invoice()
        second = self.send_invoice()
        Invoice.objects.filter(pk=first.entity_id).update(customer=self.foreign_customer)
        self.assertEqual(send_business_email_task.run(first.pk)["status"], "skipped")
        RolePermission.objects.filter(role=self.role, permission__code="invoices.send").delete()
        self.assertEqual(send_business_email_task.run(second.pk)["code"], "recipient_inactive_or_access_revoked")
        self.assertEqual(self.post(f"/api/invoices/{second.entity_id}/send/").status_code, 403)
        self.assertFalse(getattr(mail, "outbox", []))

    def test_inactive_company_and_missing_record_never_send(self):
        email = self.send_invoice()
        self.company.is_active = False
        self.company.save()
        self.assertEqual(send_business_email_task.run(email.pk)["code"], "company_inactive")
        self.assertEqual(send_business_email_task.run(999999)["status"], "invalid")
        self.assertFalse(getattr(mail, "outbox", []))

    def test_html_escaping_and_header_injection_blocked(self):
        self.company.name = 'Company <script>alert(1)</script>\r\nBcc: outsider@example.test'
        self.company.save()
        self.customer.name = '<img src=x onerror=alert(1)>'
        self.customer.save()
        with self.captureOnCommitCallbacks(execute=True):
            email = self.send_invoice()
        message = mail.outbox[0]
        self.assertFalse(message.bcc)
        self.assertNotIn("\n", message.subject)
        self.assertIsNone(message.message().get("Bcc"))
        html = message.alternatives[0].content
        self.assertNotIn("<script>", html)
        self.assertNotIn("<img src=x", html)
        self.assertIn("&lt;script&gt;", html)
        self.assertEqual(self.post(f"/api/invoices/{email.entity_id}/send/", dict(bcc="outsider@example.test")).status_code, 400)

    def test_rollback_no_email_no_audit_no_task(self):
        invoice = self.invoice()
        with patch.object(send_business_email_task, "apply_async") as publish:
            with self.captureOnCommitCallbacks(execute=True):
                with self.assertRaises(RuntimeError), transaction.atomic():
                    self.send_invoice(invoice)
                    raise RuntimeError("rollback")
            publish.assert_not_called()
        self.assertFalse(BusinessEmail.objects.exists())
        self.assertFalse(AuditLog.objects.filter(action="email.queued").exists())

    def test_quote_official_transition_pdf_and_send_permission(self):
        quote = self.post("/api/quotes/", self.quote_input()).data
        RolePermission.objects.filter(role=self.role, permission__code="quotes.export").delete()
        with self.captureOnCommitCallbacks(execute=True):
            response = self.post(f"/api/quotes/{quote['id']}/send/", key="quote-send-once")
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(Quote.objects.get(pk=quote["id"]).status, "sent")
        self.assertEqual(BusinessEmail.objects.get().status, "sent")
        message = mail.outbox[0]
        self.assertIn(quote["reference"], message.subject)
        self.assertEqual(message.to, [self.customer.email])
        self.assertEqual(message.attachments[0].mimetype, "application/pdf")
        self.assertEqual(message.alternatives[0].mimetype, "text/html")
        self.assertEqual(self.post(f"/api/quotes/{quote['id']}/send/").status_code, 200)
        self.assertEqual(BusinessEmail.objects.count(), 1)
        RolePermission.objects.filter(role=self.role, permission__code="quotes.send").delete()
        self.assertEqual(self.post(f"/api/quotes/{quote['id']}/send/").status_code, 403)

    def test_quote_missing_address_rolls_back_sent_transition(self):
        quote = self.post("/api/quotes/", self.quote_input()).data
        self.customer.email = ""
        self.customer.save()
        self.assertEqual(self.post(f"/api/quotes/{quote['id']}/send/").status_code, 400)
        self.assertEqual(Quote.objects.get(pk=quote["id"]).status, "draft")
        self.assertFalse(BusinessEmail.objects.exists())

    def test_purchase_order_recipient_and_no_invented_pdf(self):
        order = self.purchase(confirmed=False)
        with self.captureOnCommitCallbacks(execute=True):
            result = self.post(f"/api/purchase-orders/{order['id']}/send/")
            self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(BusinessEmail.objects.get().status, "sent")
        message = mail.outbox[0]
        self.assertEqual(message.to, ["supplier@example.test"])
        self.assertIn(order["reference"], message.body)
        self.assertEqual(message.attachments, [])  # No purchase-order PDF engine exists.
        self.assertEqual(message.alternatives[0].mimetype, "text/html")
        PurchaseOrder.objects.filter(pk=order["id"]).update(company=self.other_company)
        self.assertEqual(self.post(f"/api/purchase-orders/{order['id']}/send/").status_code, 404)

    def test_purchase_missing_email_rolls_back_transition(self):
        order = self.purchase(confirmed=False)
        Supplier.objects.filter(pk=order["supplierId"]).update(email="")
        self.assertEqual(self.post(f"/api/purchase-orders/{order['id']}/send/").status_code, 400)
        self.assertEqual(PurchaseOrder.objects.get(pk=order["id"]).status, "draft")

    def test_payment_confirmation_contains_allocation_without_mutating_finance(self):
        invoice = self.invoice()
        with self.captureOnCommitCallbacks(execute=True):
            result = self.payment(invoice)
            self.assertEqual(result.status_code, 201, result.data)
        email = BusinessEmail.objects.get(email_type="payment_confirmation")
        self.assertEqual(email.status, "sent")
        self.assertIn(invoice["reference"], mail.outbox[0].body)
        self.assertIn("400,00 MAD", mail.outbox[0].body)
        self.assertEqual(mail.outbox[0].to, [self.customer.email])
        payments, allocations = list(Payment.objects.values()), list(PaymentAllocation.objects.values())
        send_business_email_task.run(email.pk)
        self.assertEqual(list(Payment.objects.values()), payments)
        self.assertEqual(list(PaymentAllocation.objects.values()), allocations)
        self.assertEqual(Invoice.objects.get(pk=invoice["id"]).balance_due, 600)

    def test_payment_missing_email_does_not_cancel_financial_operation(self):
        self.customer.email = ""
        self.customer.save()
        with patch.object(send_business_email_task, "apply_async") as publish:
            with self.captureOnCommitCallbacks(execute=True):
                self.assertEqual(self.payment().status_code, 201)
            publish.assert_not_called()
        self.assertEqual(Payment.objects.count(), 1)
        self.assertEqual(BusinessEmail.objects.get().status, "failed")

    def test_temporary_smtp_retries_are_bounded_and_terminal_failure_audited(self):
        email, connection = self.send_invoice(), Mock()
        connection.send_messages.side_effect = smtplib.SMTPDataError(451, b"temporary failure")
        with patch("common.email_delivery.get_connection", return_value=connection), patch.object(send_business_email_task, "retry", side_effect=Retry()) as retry:
            for _ in range(3):
                with self.assertRaises(Retry):
                    send_business_email_task.run(email.pk)
            self.assertEqual(send_business_email_task.run(email.pk)["status"], "failed")
            self.assertEqual(retry.call_count, 3)
        email.refresh_from_db()
        self.assertEqual(email.email_attempts, 4)
        self.assertIsNotNone(email.failed_at)
        self.assertIsNone(email.email_sent_at)
        self.assertEqual(AuditLog.objects.filter(action="email.failed").count(), 1)
        self.assertFalse(getattr(mail, "outbox", []))

    def test_backend_zero_result_is_failed_not_sent(self):
        email, connection = self.send_invoice(), Mock()
        connection.send_messages.return_value = 0
        with patch("common.email_delivery.get_connection", return_value=connection):
            self.assertEqual(send_business_email_task.run(email.pk)["code"], "mail_not_accepted")
        email.refresh_from_db()
        self.assertIsNone(email.email_sent_at)

    def test_history_company_permission_and_no_secret_fields(self):
        email = self.send_invoice()
        path = f"/api/business-emails/?entity_type=invoice&entity_id={email.entity_id}"
        result = self.client.get(path)
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data["emails"][0]["status"], "pending")
        self.assertNotIn("email_claim", result.data["emails"][0])
        self.assertNotIn("body", result.data["emails"][0])
        Invoice.objects.filter(pk=email.entity_id).update(company=self.other_company)
        self.assertEqual(self.client.get(path).status_code, 404)
        RolePermission.objects.filter(role=self.role, permission__code="invoices.view").delete()
        self.assertEqual(self.client.get(path).status_code, 403)


class ApprovalEmailTests(AsyncDataMixin, TestCase):
    def setUp(self):
        super().setUp()
        RolePermission.objects.filter(role=self.role, permission__code="approvals.approve").delete()
        self.approver = User.objects.create_user(email="approver@example.test")
        member = Membership.objects.create(user=self.approver, company=self.company, is_default=True)
        role = Role.objects.create(company=self.company, code="approver", name="Approver")
        MembershipRole.objects.create(membership=member, role=role)
        for code in ["approvals.view", "approvals.approve", "expenses.view", "expenses.approve"]:
            RolePermission.objects.create(role=role, permission=Permission.objects.get(code=code))

    def test_requested_then_approved_correct_recipients_and_dedup(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.expense(submitted=True)
        self.assertEqual([m.to for m in mail.outbox], [[self.approver.email]])
        self.assertIn("Approbation demandée", mail.outbox[0].body)
        request = ApprovalRequest.objects.get()
        self.client.force_login(self.approver)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.post(f"/api/approvals/{request.pk}/approve/", dict(version=request.version, comment="Validé"))
            self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(mail.outbox[1].to, [self.user.email])
        self.assertIn("approuvée", mail.outbox[1].body)
        self.assertEqual(Notification.objects.count(), 2)
        self.assertEqual(BusinessEmail.objects.count(), 2)
        self.assertEqual(self.post(f"/api/approvals/{request.pk}/approve/", dict(version=request.version, comment="Validé")).status_code, 409)
        for notice in Notification.objects.all():
            send_notification_email.run(notice.pk)
        self.assertEqual(len(mail.outbox), 2)

    def test_rejected_notifies_requester_and_late_requested_email_skipped(self):
        self.expense(submitted=True)
        request = ApprovalRequest.objects.get()
        requested = Notification.objects.get(type="approval_requested")
        self.client.force_login(self.approver)
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.post(f"/api/approvals/{request.pk}/reject/", dict(version=request.version, comment="Justificatif absent")).status_code, 200)
        self.assertEqual(mail.outbox[0].to, [self.user.email])
        self.assertIn("Justificatif absent", mail.outbox[0].body)
        self.assertEqual(send_notification_email.run(requested.pk)["code"], "approval_state_changed")
        self.assertEqual(len(mail.outbox), 1)
