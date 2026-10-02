from rest_framework import serializers
from apps.companies.serializers import StrictSerializer
from .serializers import CommercialLineSerializer, QuoteInputSerializer
from .models import SalesOrderStatus


class QuoteConversionSerializer(StrictSerializer):
    target = serializers.ChoiceField(choices=["sales_order"], default="sales_order")


class SalesOrderInputSerializer(StrictSerializer):
    customer_id = serializers.IntegerField(min_value=1)
    salesperson = serializers.CharField(max_length=150)
    currency = serializers.ChoiceField(choices=["MAD"])
    customer_reference = serializers.CharField(max_length=5000, allow_blank=True, default="")
    billing_address = serializers.CharField(max_length=5000, allow_blank=True, default="")
    delivery_address = serializers.CharField(max_length=5000, allow_blank=True, default="")
    payment_terms = serializers.CharField(max_length=5000, allow_blank=True, default="")
    notes = serializers.CharField(max_length=5000, allow_blank=True, default="")
    lines = CommercialLineSerializer(many=True, min_length=1, max_length=100)
    validate_lines = QuoteInputSerializer.validate_lines


class SalesOrderFilterSerializer(serializers.Serializer):
    search = serializers.CharField(max_length=150, required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=SalesOrderStatus.choices, required=False)
    customer = serializers.IntegerField(min_value=1, required=False)
    salesperson = serializers.CharField(max_length=150, required=False)
    delivery_status = serializers.ChoiceField(choices=["none", "partial", "delivered"], required=False)
    payment_status = serializers.ChoiceField(choices=["unpaid", "partial", "paid"], required=False)
    ordering = serializers.ChoiceField(choices=["created_at", "-created_at", "total", "-total", "number", "-number"], required=False)
