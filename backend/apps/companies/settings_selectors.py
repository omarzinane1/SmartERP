import base64
from datetime import date

from django.conf import settings
from django.utils import timezone
from apps.accounts.selectors import get_effective_permission_codes
from apps.inventory.models import CompanyInventorySetting, Warehouse
from .constants import CURRENCIES
from .models import CompanyFinanceSetting, CompanyGeneralSetting, CompanyInvoicingSetting, CompanySalesSetting
from .settings_contract import SECTIONS, EDITABLE, LOCKED


def settings_records(company):
    year = timezone.localdate().year
    return {
        "general": CompanyGeneralSetting.objects.filter(company=company).first() or CompanyGeneralSetting(company=company),
        "finance": CompanyFinanceSetting.objects.filter(company=company).first() or CompanyFinanceSetting(
            company=company, tax_system="standard", vat_rate=0, fiscal_year_start=date(year, 1, 1),
            fiscal_year_end=date(year, 12, 31), payment_terms=30,
        ),
        "invoices": CompanyInvoicingSetting.objects.filter(company=company).first() or CompanyInvoicingSetting(
            company=company, invoice_prefix="INV", invoice_start=1, quote_prefix="QUO", quote_start=1,
            purchase_order_prefix="PO", payment_terms="", footer="", language="fr",
        ),
        "sales": CompanySalesSetting.objects.filter(company=company).first() or CompanySalesSetting(company=company),
        "inventory": CompanyInventorySetting.objects.filter(company=company).first() or CompanyInventorySetting(company=company),
    }


def settings_payload(*, company, membership):
    records = settings_records(company)
    g, f, i, s, stock = [records[key] for key in ("general", "finance", "invoices", "sales", "inventory")]
    permissions = get_effective_permission_codes(membership=membership)
    logo = f"data:{company.logo_mime_type};base64,{base64.b64encode(bytes(company.logo)).decode()}" if company.logo else None
    values = {
        "general": dict(language=g.language, timezone=company.timezone, dateFormat=g.date_format, currency=company.currency, numberFormat=g.number_format),
        "company": dict(companyName=company.name, legalName=company.legal_name, taxId=company.tax_id, email=company.email, phone=company.phone, address=company.address, city=company.city, country=company.country, logoUrl=logo),
        "branches": dict(activeBranches=[], defaultBranch=""),
        "finance": dict(currency=company.currency, fiscalYearStart=f.fiscal_year_start.isoformat(), defaultAccount="", paymentTerms=f.payment_terms_label or f"{f.payment_terms} jours", rounding="half_up_2"),
        "taxes": dict(activeTaxes=[], vatRate=f.vat_rate, inclusive=False, rounding="half_up_2"),
        "invoices": dict(prefix=i.invoice_prefix, numbering=f"{i.invoice_prefix}-YYYY-NNNN", paymentTerms=i.payment_terms, defaultDueDays=i.default_due_days, notes=i.footer, sendEmail=False),
        "sales": dict(quotePrefix=i.quote_prefix, orderPrefix=s.order_prefix, quoteValidityDays=s.quote_validity_days, reserveStock=False, requireApproval=False),
        "purchasing": dict(prefix=i.purchase_order_prefix, approvalThreshold=0, defaultWarehouse="", defaultTax=""),
        "inventory": dict(allowNegative=False, valuationMethod={"weighted_average": "average_cost"}.get(stock.valuation_method, stock.valuation_method), minimumStock=0, unit=stock.default_unit, alerts=stock.low_stock_alerts),
        "documents": dict(allowedFormats=[], maxSizeMB=0, autoIndex=False, retentionDays=0, ragEnabled=False),
        "users": dict(allowInvitations=True, defaultRole="", sessionTimeoutMinutes=settings.SESSION_COOKIE_AGE // 60, passwordPolicySummary="Politique de mot de passe Django."),
        "notifications": dict(email=False, inApp=False, stockAlerts=False, invoiceOverdue=False, approvals=False, aiAlerts=False),
        "security": dict(require2FA=False, sessionMinutes=settings.SESSION_COOKIE_AGE // 60, passwordPolicy="django", sensitiveApproval=False, auditRetentionDays=0),
        "ai": dict(allowAnalysis=False, allowDocumentRag=False, allowForecasting=False, allowRecommendations=False, requireSensitiveApproval=False),
        "integrations": dict(items=[]),
    }
    return {
        "values": values,
        "policies": {key: dict(canView=key in EDITABLE, canManage=key in EDITABLE and "settings.manage" in permissions,
                               lockedFields=LOCKED.get(key, list(values[key])),
                               explanation="Les champs verrouillés dépendent de fonctionnalités non disponibles ou de règles fixes." if key in EDITABLE else "Fonctionnalité non disponible dans ce jalon.") for key in SECTIONS},
        "permissions": permissions, "asOf": timezone.localdate().isoformat(), "version": company.settings_version,
        "options": dict(languages=["fr", "en", "ar"], timezones=["Africa/Casablanca", "Europe/Paris", "UTC"],
                        dateFormats=["DD/MM/YYYY", "YYYY-MM-DD", "MM/DD/YYYY"], currencies=list(CURRENCIES),
                        numberFormats=["fr-FR", "en-US", "ar-MA"], rounding=["half_up_2"], valuationMethods=["average_cost", "fifo"],
                        units=["unit", "kg", "m", "l", "box", "hour"], accounts=[], taxes=[], passwordPolicies=["django"],
                        warehouses=[dict(id=str(w.pk), name=w.name) for w in Warehouse.objects.filter(company=company, is_active=True)],
                        roles=[dict(id=str(r.pk), name=r.name) for r in company.roles.filter(is_active=True).exclude(code="owner")]),
    }
