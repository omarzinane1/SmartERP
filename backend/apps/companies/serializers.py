from collections.abc import Mapping

from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from .constants import CURRENCIES
from .models import ModuleDefinition
from .validators import validate_logo


class StrictSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if isinstance(data, Mapping):
            if {"id", "company_id", "membership_id", "user_id"} & data.keys():
                raise PermissionDenied("Le contexte de société est déterminé par la session.")
            unknown = data.keys() - self.fields.keys()
            if unknown:
                raise serializers.ValidationError({
                    key: ["Champ inconnu."] for key in sorted(unknown)
                })
        return super().to_internal_value(data)


class CompanyOnboardingSerializer(StrictSerializer):
    name = serializers.CharField(max_length=255)
    legal_name = serializers.CharField(max_length=255)
    logo = serializers.CharField(required=False, allow_null=True, allow_blank=True, default=None,
                                 max_length=2_800_000, trim_whitespace=False)
    tax_id = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    website = serializers.URLField(max_length=500, required=False, allow_blank=True, default="")
    address = serializers.CharField(max_length=500)
    city = serializers.CharField(max_length=100)
    postal_code = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    country = serializers.RegexField(r"^[A-Z]{2}$")
    currency = serializers.ChoiceField(choices=CURRENCIES)

    def validate_logo(self, value):
        return validate_logo(value)


class BusinessOnboardingSerializer(StrictSerializer):
    industry = serializers.CharField(max_length=100)
    business_type = serializers.ChoiceField(choices=("products", "services", "both"))
    main_activity = serializers.CharField(max_length=255)
    size = serializers.ChoiceField(choices=("solo", "micro", "small", "medium", "large"))
    employee_count = serializers.IntegerField(
        min_value=0, max_value=2147483647, allow_null=True, required=False, default=None,
    )
    description = serializers.CharField(max_length=10000, allow_blank=True, required=False, default="")


class FinanceOnboardingSerializer(StrictSerializer):
    currency = serializers.ChoiceField(choices=CURRENCIES)
    tax_system = serializers.ChoiceField(choices=("standard", "simplified", "exempt"))
    vat_rate = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=0, max_value=100)
    fiscal_year_start = serializers.DateField()
    fiscal_year_end = serializers.DateField()
    payment_terms = serializers.ChoiceField(choices=("0", "15", "30", "45", "60", "90"))

    def validate(self, attrs):
        if attrs["fiscal_year_end"] < attrs["fiscal_year_start"]:
            raise serializers.ValidationError({
                "fiscal_year_end": ["La fin de l'exercice doit suivre sa date de début."]
            })
        return attrs


class InventoryOnboardingSerializer(StrictSerializer):
    enabled = serializers.BooleanField()
    warehouse_name = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    warehouse_code = serializers.RegexField(r"^[A-Za-z0-9_-]+$", max_length=50,
                                           required=False, allow_blank=True, default="")
    warehouse_address = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")
    multi_warehouse = serializers.BooleanField(required=False, default=False)
    valuation_method = serializers.ChoiceField(
        choices=("weighted_average", "fifo", "standard"), required=False, default="weighted_average",
    )
    low_stock_alerts = serializers.BooleanField(required=False, default=True)
    default_unit = serializers.ChoiceField(
        choices=("unit", "kg", "litre", "metre", "box"), required=False, default="unit",
    )

    def validate(self, attrs):
        if not attrs["enabled"]:
            return {"enabled": False}
        errors = {
            key: ["Ce champ est obligatoire lorsque le stock est activé."]
            for key in ("warehouse_name", "warehouse_code") if not attrs[key]
        }
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class InvoicingOnboardingSerializer(StrictSerializer):
    invoice_prefix = serializers.RegexField(r"^[A-Za-z0-9_-]+$", max_length=20)
    invoice_start = serializers.IntegerField(min_value=1, max_value=999999999)
    quote_prefix = serializers.RegexField(r"^[A-Za-z0-9_-]+$", max_length=20)
    quote_start = serializers.IntegerField(min_value=1, max_value=999999999)
    purchase_order_prefix = serializers.RegexField(r"^[A-Za-z0-9_-]+$", max_length=20)
    payment_terms = serializers.CharField(max_length=1000)
    footer = serializers.CharField(max_length=10000, required=False, allow_blank=True, default="")
    language = serializers.ChoiceField(choices=("fr", "en", "ar"))
    show_vat = serializers.BooleanField()


class OnboardingSerializer(StrictSerializer):
    company = CompanyOnboardingSerializer()
    business = BusinessOnboardingSerializer()
    finance = FinanceOnboardingSerializer()
    inventory = InventoryOnboardingSerializer()
    invoicing = InvoicingOnboardingSerializer()
    modules = serializers.ListField(
        child=serializers.CharField(max_length=50), min_length=1, max_length=16,
    )

    def validate_modules(self, codes):
        if len(codes) != len(set(codes)):
            raise serializers.ValidationError("Un module ne peut être sélectionné qu'une fois.")
        known = set(ModuleDefinition.objects.filter(
            code__in=codes, is_active=True,
        ).values_list("code", flat=True))
        if set(codes) != known:
            raise serializers.ValidationError("Un module demandé est inconnu ou inactif.")
        return codes

    def validate(self, attrs):
        if attrs["company"]["currency"] != attrs["finance"]["currency"]:
            raise serializers.ValidationError({
                "company": {"currency": ["Les devises de la société et de la finance doivent correspondre."]}
            })
        if not attrs["inventory"]["enabled"] and {"inventory", "warehouses"} & set(attrs["modules"]):
            raise serializers.ValidationError({
                "modules": ["Les modules Stock et Dépôts nécessitent l'activation du stock."]
            })
        return attrs
