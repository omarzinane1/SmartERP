from apps.notifications.selectors import recipient_memberships
from apps.notifications.services import create_notification
from .summary_selectors import overdue_invoices


def notify_overdue_company(company):
    permissions = ["invoices.view"]
    recipients = list(recipient_memberships(company, permissions).values_list("user_id", flat=True))
    if not recipients:
        return 0
    created = 0
    for invoice in overdue_invoices(company).only("pk", "number").iterator(chunk_size=500):
        for recipient_id in recipients:
            _, new = create_notification(company=company, recipient_id=recipient_id, type="invoice_overdue",
                title="Facture en retard", message=f"La facture {invoice.number} présente un solde exigible.",
                entity_type="invoice", entity_id=invoice.pk, dedupe_key=f"invoice_overdue:{invoice.pk}", permissions=permissions)
            created += new
    return created
