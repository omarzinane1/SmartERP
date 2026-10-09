"""Business validation and rendering. SMTP transport has no ERP-specific rules."""
from django.core.exceptions import ValidationError as AddressError
from django.core.validators import validate_email
from django.template.loader import render_to_string
from rest_framework.exceptions import NotFound, ValidationError
from common.dates import company_today
from common.email_delivery import SkipDelivery, active_membership


def notification_message(notification):
    from .selectors import entity_exists
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
    return member.user.email, notification.title, "", member.company


def address(value):
    try:
        validate_email(value)
    except AddressError as error:
        raise ValidationError({"email": ["Adresse e-mail du destinataire absente ou invalide."]}) from error
    return value


def actor_for(email, permissions):
    if not email.requested_by_id:
        raise SkipDelivery("requester_missing")
    return active_membership(email.company_id, email.requested_by_id, permissions)


def business_context(email):
    company = email.company
    if not company.is_active:
        raise SkipDelivery("company_inactive")
    data = dict(company=company)
    kind, pk = email.email_type, email.entity_id
    expected = {"invoice": "invoice", "invoice_reminder": "invoice", "quote": "quote", "purchase_order": "purchaseorder", "payment_confirmation": "payment",
        "approval_requested": "approval", "approval_approved": "approval", "approval_rejected": "approval"}.get(kind)
    if expected and email.entity_type != expected:
        raise SkipDelivery("tenant_mismatch")
    if kind in {"invoice", "invoice_reminder"}:
        from apps.sales.invoice_selectors import invoice_by_id
        member = actor_for(email, ["invoices.send", "invoices.view"] if kind == "invoice" else ["invoices.remind"])
        invoice = invoice_by_id(company=company, invoice_id=pk)
        if invoice.status != "posted" or invoice.currency != company.currency:
            raise SkipDelivery("invalid_invoice_state")
        if kind == "invoice_reminder" and (invoice.balance_due <= 0 or invoice.due_date >= company_today(company)):
            raise SkipDelivery("invoice_no_longer_overdue")
        if invoice.customer.status in {"blocked", "archived", "inactive"}:
            raise SkipDelivery("customer_inactive")
        if email.reminder_id and (email.reminder.company_id != company.pk or email.reminder.invoice_id != invoice.pk):
            raise SkipDelivery("tenant_mismatch")
        data.update(document=invoice, customer=invoice.customer, member=member, number=invoice.number, total=invoice.total, balance=invoice.balance_due,
            currency=invoice.currency, date=invoice.issue_date, due_date=invoice.due_date)
        recipient = invoice.customer.email
        subject = ("Relance facture " if kind == "invoice_reminder" else "Facture ")+invoice.number
        template = "invoices/overdue_reminder" if kind == "invoice_reminder" else "invoices/invoice_sent"
    elif kind == "quote":
        from apps.sales.selectors import quote_by_id
        member = actor_for(email, ["quotes.send", "quotes.view"])
        quote = quote_by_id(company=company, quote_id=pk)
        if quote.status not in {"sent", "viewed"} or quote.expires_at < company_today(company):
            raise SkipDelivery("invalid_quote_state")
        if quote.customer.status in {"blocked", "archived", "inactive"}:
            raise SkipDelivery("customer_inactive")
        data.update(document=quote, customer=quote.customer, member=member, number=quote.number, total=quote.total, currency=quote.currency, date=quote.issue_date, due_date=quote.expires_at)
        recipient, subject, template = quote.customer.email, "Devis "+quote.number, "quotes/quote_sent"
    elif kind == "purchase_order":
        from apps.purchasing.selectors import purchase_by_id
        actor_for(email, ["purchases.edit", "purchases.view"])
        order = purchase_by_id(company, pk)
        if order.status not in {"sent", "confirmed", "partially_received", "received"} or order.supplier.status != "active":
            raise SkipDelivery("invalid_purchase_state")
        data.update(document=order, supplier=order.supplier, number=order.number, total=order.total, currency=order.currency, date=order.date, due_date=order.expected_date)
        recipient, subject, template = order.supplier.email, "Commande fournisseur "+order.number, "purchases/purchase_order_sent"
    elif kind == "payment_confirmation":
        from apps.finance.models import Payment
        actor_for(email, ["payments.create", "payments.view"])
        payment = Payment.objects.select_related("customer").filter(pk=pk, company=company, customer__company=company, direction="incoming").first()
        if payment is None:
            raise NotFound()
        if payment.status != "completed" or payment.currency != company.currency:
            raise SkipDelivery("invalid_payment_state")
        if payment.customer.status in {"blocked", "archived", "inactive"}:
            raise SkipDelivery("customer_inactive")
        references = list(payment.allocations.filter(company=company, invoice__company=company, invoice__customer=payment.customer, reversed_at__isnull=True).values_list("invoice__number", flat=True))
        data.update(document=payment, customer=payment.customer, number=payment.number, total=payment.amount, currency=payment.currency, date=payment.date, invoice_references=references)
        recipient, subject, template = payment.customer.email, "Confirmation de paiement "+payment.number, "payments/payment_received"
    else:
        notice = email.notification
        if notice is None or notice.company_id != company.pk or notice.recipient_id != email.recipient_user_id or notice.entity_id != email.entity_id or notice.entity_type != email.entity_type:
            raise SkipDelivery("tenant_mismatch")
        recipient, subject, _, _ = notification_message(notice)
        data["notification"] = notice
        if kind.startswith("approval_"):
            from apps.approvals.models import ApprovalRequest
            approval = ApprovalRequest.objects.select_related("requested_by", "expense", "purchase_order").filter(pk=pk, company=company).first()
            expected = {"approval_requested": "pending", "approval_approved": "approved", "approval_rejected": "rejected"}[kind]
            if approval is None or approval.status != expected:
                raise SkipDelivery("approval_state_changed")
            entity = approval.expense if approval.expense_id else approval.purchase_order
            if entity.company_id != company.pk:
                raise SkipDelivery("tenant_mismatch")
            data.update(approval=approval, number=entity.number, total=entity.total, currency=entity.currency, date=approval.requested_at,
                requester=approval.requested_by.get_full_name() or approval.requested_by.email)
            template = "approvals/"+kind.split("_", 1)[1]
        else:
            template = "notifications/generic"
    data["company_name"] = company.legal_name or company.name
    configuration = getattr(company, "invoicing_setting", None)
    data["footer"] = configuration.footer if configuration else ""
    return address(recipient), " ".join(f"{subject} — {data['company_name']}".split())[:250], template, data


def build_business_email(email, *, attachments=True):
    recipient, subject, template, data = business_context(email)
    files = []
    if attachments and email.email_type in {"invoice", "quote"}:
        from apps.reporting.pdf_selectors import commercial_pdf_data
        from common.pdf.commercial import render_commercial_pdf
        pdf = commercial_pdf_data(email.company, data["member"], email.email_type, email.entity_id, purpose="email")
        files.append((data["number"]+".pdf", render_commercial_pdf(pdf), "application/pdf"))
    return dict(recipient=recipient, subject=subject, body=render_to_string(f"emails/{template}.txt", data),
        html=render_to_string(f"emails/{template}.html", data), attachments=files, company=email.company)
