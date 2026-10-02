"""Transport contract from features/settings; unsupported engines are hidden."""
from rest_framework import serializers
from .serializers import StrictSerializer
from .constants import CURRENCIES

SECTIONS = "general company branches finance taxes invoices sales purchasing inventory documents users notifications security ai integrations".split()
EDITABLE = {"general", "company", "finance", "taxes", "invoices", "sales", "inventory"}
LOCKED = {
    "general": ["currency"], "company": ["logoUrl"],
    "finance": ["currency", "rounding", "defaultAccount"],
    "taxes": ["activeTaxes", "inclusive", "rounding"],
    "invoices": ["numbering", "sendEmail"],
    "sales": ["reserveStock", "requireApproval"],
    "inventory": ["allowNegative", "valuationMethod", "minimumStock"],
}


class SettingsPatchSerializer(StrictSerializer):
    values = serializers.DictField()
    version = serializers.IntegerField(min_value=1)


class GeneralSerializer(StrictSerializer):
    language = serializers.ChoiceField(choices=["fr", "en", "ar"])
    timezone = serializers.ChoiceField(choices=["Africa/Casablanca", "Europe/Paris", "UTC"])
    dateFormat = serializers.ChoiceField(choices=["DD/MM/YYYY", "YYYY-MM-DD", "MM/DD/YYYY"])
    currency = serializers.ChoiceField(choices=CURRENCIES)
    numberFormat = serializers.ChoiceField(choices=["fr-FR", "en-US", "ar-MA"])


class CompanySettingSerializer(StrictSerializer):
    companyName = serializers.CharField(max_length=150)
    legalName = serializers.CharField(max_length=255, allow_blank=True)
    taxId = serializers.CharField(max_length=100, allow_blank=True)
    email = serializers.EmailField(allow_blank=True)
    phone = serializers.CharField(max_length=50, allow_blank=True)
    address = serializers.CharField(max_length=500, allow_blank=True)
    city = serializers.CharField(max_length=100, allow_blank=True)
    country = serializers.CharField(max_length=2, allow_blank=True)
    logoUrl = serializers.CharField(allow_null=True, allow_blank=True)

    def validate_country(self, value):
        if value and (len(value) != 2 or not value.isalpha()):
            raise serializers.ValidationError("Code pays ISO de deux lettres attendu.")
        return value.upper()


class FinanceSerializer(StrictSerializer):
    currency = serializers.ChoiceField(choices=CURRENCIES)
    fiscalYearStart = serializers.DateField()
    defaultAccount = serializers.CharField(allow_blank=True, max_length=150)
    paymentTerms = serializers.CharField(allow_blank=True, max_length=1000)
    rounding = serializers.ChoiceField(choices=["half_up_2"])


class TaxSerializer(StrictSerializer):
    activeTaxes = serializers.ListField(child=serializers.CharField(), max_length=100)
    vatRate = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=0, max_value=100)
    inclusive = serializers.BooleanField()
    rounding = serializers.ChoiceField(choices=["half_up_2"])


class InvoiceSettingSerializer(StrictSerializer):
    prefix = serializers.RegexField(r"^[A-Za-z0-9_-]{1,20}$")
    numbering = serializers.CharField(max_length=100)
    paymentTerms = serializers.CharField(allow_blank=True, max_length=1000)
    defaultDueDays = serializers.IntegerField(min_value=1, max_value=3650)
    notes = serializers.CharField(allow_blank=True, max_length=1000)
    sendEmail = serializers.BooleanField()


class SalesSettingSerializer(StrictSerializer):
    quotePrefix = serializers.RegexField(r"^[A-Za-z0-9_-]{1,20}$")
    orderPrefix = serializers.RegexField(r"^[A-Za-z0-9_-]{1,20}$")
    quoteValidityDays = serializers.IntegerField(min_value=1, max_value=3650)
    reserveStock = serializers.BooleanField()
    requireApproval = serializers.BooleanField()


class InventorySettingSerializer(StrictSerializer):
    allowNegative = serializers.BooleanField()
    valuationMethod = serializers.CharField(max_length=30)
    minimumStock = serializers.IntegerField(min_value=0, max_value=100000)
    unit = serializers.ChoiceField(choices=["unit", "kg", "m", "l", "box", "hour"])
    alerts = serializers.BooleanField()


SECTION_SERIALIZERS = dict(zip(
    ["general", "company", "finance", "taxes", "invoices", "sales", "inventory"],
    [GeneralSerializer, CompanySettingSerializer, FinanceSerializer, TaxSerializer,
     InvoiceSettingSerializer, SalesSettingSerializer, InventorySettingSerializer],
))
