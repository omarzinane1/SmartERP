from decimal import Decimal
from rest_framework import serializers
from apps.companies.serializers import StrictSerializer
from .models import QuoteStatus


class CommercialLineSerializer(StrictSerializer):
    product_id = serializers.IntegerField(min_value=1, allow_null=True, default=None)
    description = serializers.CharField(max_length=5000, allow_blank=True)
    quantity = serializers.DecimalField(max_digits=9, decimal_places=3, min_value=Decimal("0.001"), max_value=Decimal("100000"))
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0, max_value=Decimal("1000000"))
    discount_rate = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=0, max_value=100)
    tax_rate = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=0, max_value=100)

    def validate(self, data):
        if not data.get("product_id") and not data.get("description"):
            raise serializers.ValidationError({"description": ["Produit ou description obligatoire."]})
        return data


class QuoteInputSerializer(StrictSerializer):
    customer_id = serializers.IntegerField(min_value=1)
    billing_address = serializers.CharField(max_length=5000, allow_blank=True)
    salesperson = serializers.CharField(max_length=150)
    issue_date = serializers.DateField()
    expires_at = serializers.DateField()
    currency = serializers.ChoiceField(choices=["MAD"])
    payment_terms = serializers.CharField(max_length=5000, allow_blank=True)
    customer_reference = serializers.CharField(max_length=5000, allow_blank=True)
    subject = serializers.CharField(max_length=5000, allow_blank=True)
    delivery_terms = serializers.CharField(max_length=5000, allow_blank=True)
    commercial_terms = serializers.CharField(max_length=5000, allow_blank=True)
    internal_notes = serializers.CharField(max_length=5000, allow_blank=True)
    customer_notes = serializers.CharField(max_length=5000, allow_blank=True)
    lines = CommercialLineSerializer(many=True, min_length=1, max_length=100)

    def validate_lines(self, value):
        # PATCH may omit the collection, but supplied replacement rows are full.
        serializer = CommercialLineSerializer(data=value, many=True)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data

    def validate(self, data):
        if "issue_date" in data and "expires_at" in data and data["expires_at"] < data["issue_date"]:
            raise serializers.ValidationError({"expires_at": ["L'expiration doit suivre la date du devis."]})
        return data


class QuoteFilterSerializer(serializers.Serializer):
    search = serializers.CharField(max_length=150, required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=["all", *QuoteStatus.values], required=False)
    customer = serializers.IntegerField(min_value=1, required=False)
    salesperson = serializers.CharField(max_length=150, required=False)
    created_after = serializers.DateField(required=False)
    created_before = serializers.DateField(required=False)
    ordering = serializers.ChoiceField(choices=["reference", "-reference", "created_at", "-created_at", "expires_at", "-expires_at", "total_amount", "-total_amount", "status"], required=False)


class EmptyActionSerializer(StrictSerializer):
    pass
