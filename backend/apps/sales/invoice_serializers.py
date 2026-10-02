from decimal import Decimal
from rest_framework import serializers
from apps.companies.serializers import StrictSerializer
from .models import InvoiceStatus
from .serializers import CommercialLineSerializer


class InvoiceLineSerializer(CommercialLineSerializer):
    product_name = serializers.CharField(max_length=5000, allow_blank=True)

    def validate(self, data):
        if not any(data.get(field) for field in ("product_id", "product_name", "description")):
            raise serializers.ValidationError({"description": ["Produit ou description obligatoire."]})
        return data


class InvoiceInputSerializer(StrictSerializer):
    customer_id = serializers.IntegerField(min_value=1)
    billing_address = serializers.CharField(max_length=5000, allow_blank=True)
    invoice_date = serializers.DateField(source="issue_date")
    due_date = serializers.DateField()
    salesperson = serializers.CharField(max_length=150)
    currency = serializers.ChoiceField(choices=["MAD"])
    payment_terms = serializers.CharField(max_length=5000, allow_blank=True)
    customer_reference = serializers.CharField(max_length=5000, allow_blank=True)
    notes = serializers.CharField(max_length=5000, allow_blank=True)
    lines = InvoiceLineSerializer(many=True, min_length=1, max_length=100)

    def validate_lines(self, value):
        serializer = InvoiceLineSerializer(data=value, many=True)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data

    def validate(self, data):
        if "issue_date" in data and "due_date" in data and data["due_date"] < data["issue_date"]:
            raise serializers.ValidationError({"due_date": ["L'échéance doit suivre la date de facture."]})
        return data


class OrderInvoiceInputSerializer(StrictSerializer):
    amount = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=Decimal("0.01"))


class InvoiceFilterSerializer(serializers.Serializer):
    search = serializers.CharField(max_length=150, required=False, allow_blank=True)
    customer_id = serializers.IntegerField(min_value=1, required=False)
    salesperson = serializers.CharField(max_length=150, required=False)
    workflow = serializers.ChoiceField(choices=InvoiceStatus.choices, required=False)
    payment = serializers.ChoiceField(choices=["unpaid", "partially_paid", "paid"], required=False)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    due_from = serializers.DateField(required=False)
    due_to = serializers.DateField(required=False)
    min_amount = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=0, required=False)
    max_amount = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=0, required=False)
    aging = serializers.ChoiceField(choices=["current", "1-30", "31-60", "61-90", "90+"], required=False)
    ordering = serializers.ChoiceField(choices=["issue_date", "-issue_date", "due_date", "-due_date", "total", "-total", "balance_due", "-balance_due", "number"], required=False)
