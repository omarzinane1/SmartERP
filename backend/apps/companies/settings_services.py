from django.db import transaction
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from apps.accounts.services import require_actor
from common.exceptions import BusinessConflict
from .models import Company
from .settings_contract import EDITABLE, LOCKED, SECTIONS, SECTION_SERIALIZERS
from .settings_selectors import settings_payload, settings_records


@transaction.atomic
def update_settings(*, company, membership, section, data):
    company = Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="settings.manage")
    if section not in SECTIONS:
        raise NotFound()
    if section not in EDITABLE:
        raise PermissionDenied("Section indisponible dans ce jalon.")
    if data["version"] != company.settings_version:
        raise BusinessConflict("Les paramètres ont changé. Rechargez la version courante.")
    current = settings_payload(company=company, membership=membership)["values"][section]
    for key in LOCKED.get(section, []):
        if key in data["values"] and data["values"][key] != current[key]:
            raise PermissionDenied(f"Le champ {key} est verrouillé.")
    serializer = SECTION_SERIALIZERS[section](data=data["values"], partial=True)
    serializer.is_valid(raise_exception=True)
    values = serializer.validated_data
    records = settings_records(company)
    if section == "company":
        mapping = {"companyName": "name", "legalName": "legal_name", "taxId": "tax_id", **{k: k for k in ("email", "phone", "address", "city", "country")}}
        for key, field in mapping.items():
            if key in values:
                setattr(company, field, values[key])
    else:
        record = records["finance" if section == "taxes" else section]
        mapping = {
            "general": {"language": "language", "dateFormat": "date_format", "numberFormat": "number_format"},
            "finance": {"fiscalYearStart": "fiscal_year_start", "paymentTerms": "payment_terms_label"},
            "taxes": {"vatRate": "vat_rate"},
            "invoices": {"prefix": "invoice_prefix", "paymentTerms": "payment_terms", "defaultDueDays": "default_due_days", "notes": "footer"},
            "sales": {"orderPrefix": "order_prefix", "quoteValidityDays": "quote_validity_days"},
            "inventory": {"unit": "default_unit", "alerts": "low_stock_alerts"},
        }[section]
        for key, field in mapping.items():
            if key in values:
                setattr(record, field, values[key])
        if section == "finance" and record.fiscal_year_start > record.fiscal_year_end:
            raise ValidationError({"fiscalYearStart": ["Le début doit précéder la fin d'exercice définie à l'onboarding."]})
        record.save()
        if section == "general" and "timezone" in values:
            company.timezone = values["timezone"]
        if section == "sales" and "quotePrefix" in values:
            records["invoices"].quote_prefix = values["quotePrefix"]
            records["invoices"].save()
    company.settings_version += 1
    company.save()
    return settings_payload(company=company, membership=membership)
