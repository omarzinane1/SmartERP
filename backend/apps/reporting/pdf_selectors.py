from django.db import transaction
from apps.accounts.services import require_actor
from apps.companies.models import Company


@transaction.atomic
def commercial_pdf_data(company, membership, kind, pk, *, purpose="download"):
    Company.objects.select_for_update().get(pk=company.pk)
    if kind == "invoice":
        require_actor(company=company, actor=membership, permission_code="invoices.view")
        from apps.sales.invoice_selectors import invoice_by_id
        obj = invoice_by_id(company=company, invoice_id=pk)
    else:
        for permission in ("quotes.view", "quotes.send" if purpose == "email" else "quotes.export"):
            require_actor(company=company, actor=membership, permission_code=permission)
        from apps.sales.selectors import quote_by_id
        obj = quote_by_id(company=company, quote_id=pk)
    configuration = getattr(company, "invoicing_setting", None)
    totals = [("Total HT", obj.subtotal), ("TVA", obj.tax_total), ("Total TTC", obj.total)]
    if kind == "invoice":
        totals.extend([("Avoirs", obj.credit_total), ("Déjà payé", obj.amount_paid), ("Reste dû", obj.balance_due)])
    return dict(title="Facture" if kind == "invoice" else "Devis", number=obj.number, status=obj.get_status_display(),
        date=obj.issue_date.isoformat(), due_date=(obj.due_date if kind == "invoice" else obj.expires_at).isoformat(), due_label="Échéance" if kind == "invoice" else "Validité",
        currency=obj.currency, customer_name=obj.customer.name, billing_address=obj.billing_address, payment_terms=obj.payment_terms,
        notes=obj.notes if kind == "invoice" else obj.customer_notes, totals=totals,
        company=dict(name=company.legal_name or company.name, address="\n".join(value for value in [company.address, " ".join(value for value in [company.postal_code, company.city, company.country] if value)] if value),
            contact=" | ".join(value for value in [company.email, company.phone, company.website] if value), tax_id=company.tax_id,
            logo=bytes(company.logo) if company.logo else None, footer=configuration.footer if configuration else ""),
        lines=[dict(name=line.product_name, description=line.description, quantity=line.quantity, unit_price=line.unit_price,
            discount_rate=line.discount_rate, tax_rate=line.tax_rate, subtotal=line.subtotal, total=line.line_total) for line in obj.lines.all()])
