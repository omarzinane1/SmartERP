from rest_framework import serializers
from apps.companies.serializers import StrictSerializer
from .models import CustomerStatus


class CustomerInputSerializer(StrictSerializer):
    name = serializers.CharField(min_length=2, max_length=120)
    type = serializers.ChoiceField(choices=["company", "individual"])
    phone = serializers.CharField(max_length=30, allow_blank=True)
    email = serializers.EmailField(max_length=150)
    city = serializers.CharField(max_length=60)
    salesperson = serializers.CharField(max_length=150, allow_blank=True)
    status = serializers.ChoiceField(choices=CustomerStatus.choices, required=False)
    tags = serializers.ListField(child=serializers.CharField(max_length=40), max_length=50, required=False)

    def validate_tags(self, value):
        return list(dict.fromkeys(value))


class CustomerFilterSerializer(serializers.Serializer):
    search = serializers.CharField(max_length=150, required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=["all", *CustomerStatus.values], required=False)
    city = serializers.CharField(max_length=60, required=False)
    salesperson = serializers.CharField(max_length=150, required=False)
    outstanding = serializers.BooleanField(required=False)
    overdue = serializers.BooleanField(required=False)
    ordering = serializers.ChoiceField(choices=["name", "-name", "created_at", "-created_at", "revenue", "-revenue", "outstanding", "-outstanding"], required=False)
