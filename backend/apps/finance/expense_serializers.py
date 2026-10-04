from decimal import Decimal
from rest_framework import serializers
from apps.companies.serializers import StrictSerializer


class ExpenseInput(StrictSerializer):
    date = serializers.DateField()
    description = serializers.CharField(min_length=3, max_length=300)
    category = serializers.CharField(max_length=80)
    supplier_id = serializers.IntegerField(min_value=1, allow_null=True)
    employee = serializers.CharField(min_length=2, max_length=120)
    amount_ht = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"), max_value=1000000)
    tax_rate = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=0, max_value=100)
    note = serializers.CharField(max_length=3000, allow_blank=True)


class ExpenseCategoryInput(StrictSerializer):
    name = serializers.CharField(max_length=80)
    code = serializers.CharField(max_length=80, required=False)
    description = serializers.CharField(max_length=500, allow_blank=True, default="")
    is_active = serializers.BooleanField(required=False)


class RejectExpenseInput(StrictSerializer):
    reason = serializers.CharField(max_length=2000)


class ExpenseFilter(serializers.Serializer):
    search = serializers.CharField(max_length=150, required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=["draft", "submitted", "approved", "rejected", "paid"], required=False)
    category = serializers.CharField(max_length=80, required=False)
    supplier_id = serializers.IntegerField(min_value=1, required=False)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
