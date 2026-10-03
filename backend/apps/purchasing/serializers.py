from decimal import Decimal
from rest_framework import serializers
from apps.companies.serializers import StrictSerializer
from apps.sales.invoice_serializers import InvoiceLineSerializer
from apps.sales.invoice_serializers import CreditLineInputSerializer


class SupplierInputSerializer(StrictSerializer):
    name = serializers.CharField(min_length=2, max_length=150)
    contact = serializers.CharField(max_length=120, allow_blank=True)
    email = serializers.EmailField(allow_blank=True)
    phone = serializers.CharField(max_length=30, allow_blank=True)
    category = serializers.CharField(max_length=80)
    country = serializers.CharField(max_length=80)
    city = serializers.CharField(max_length=80)
    buyer = serializers.CharField(max_length=150)
    status = serializers.ChoiceField(choices=["active", "inactive", "blocked", "archived"], required=False)


class SupplierFilterSerializer(serializers.Serializer):
    search = serializers.CharField(max_length=150, allow_blank=True, required=False)
    category = serializers.CharField(max_length=80, allow_blank=True, required=False)
    country = serializers.CharField(max_length=80, allow_blank=True, required=False)
    city = serializers.CharField(max_length=80, allow_blank=True, required=False)
    buyer = serializers.CharField(max_length=150, allow_blank=True, required=False)
    risk = serializers.ChoiceField(choices=["", "low", "medium", "high"], required=False)
    status = serializers.ChoiceField(choices=["", "active", "inactive", "blocked", "archived"], required=False)
    quick = serializers.ChoiceField(choices=["", "active", "risk", "balance", "delay", "new"], required=False)
    strategic = serializers.BooleanField(required=False)
    sort = serializers.ChoiceField(choices=["name", "purchase_desc", "balance_desc", "score_desc"], default="name")


class PurchaseLineInputSerializer(InvoiceLineSerializer):
    product_name = serializers.CharField(max_length=200)
    description = serializers.CharField(max_length=2000, allow_blank=True)


class PurchaseInputSerializer(StrictSerializer):
    supplier_id = serializers.IntegerField(min_value=1)
    date = serializers.DateField()
    expected_date = serializers.DateField()
    buyer = serializers.CharField(max_length=150)
    warehouse = serializers.CharField(max_length=255)
    notes = serializers.CharField(max_length=5000, allow_blank=True)
    lines = PurchaseLineInputSerializer(many=True, min_length=1, max_length=100)

    def validate_lines(self, value):
        serializer = PurchaseLineInputSerializer(data=value, many=True)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data


class ReceiptInputSerializer(StrictSerializer):
    date = serializers.DateField()
    warehouse = serializers.CharField(max_length=255)
    lines = CreditLineInputSerializer(many=True, min_length=1, max_length=100)


class PurchaseFilterSerializer(serializers.Serializer):
    search = serializers.CharField(max_length=150, required=False, allow_blank=True)
    supplier_id = serializers.IntegerField(min_value=1, required=False)
    status = serializers.ChoiceField(choices=["draft", "sent", "confirmed", "cancelled"], required=False)
