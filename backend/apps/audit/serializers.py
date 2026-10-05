from rest_framework import serializers
from apps.companies.serializers import StrictSerializer


class AuditFilter(StrictSerializer):
    search = serializers.CharField(max_length=150, required=False, allow_blank=True)
    actor = serializers.CharField(max_length=150, required=False, allow_blank=True)
    action = serializers.CharField(max_length=80, required=False, allow_blank=True)
    entity_type = serializers.CharField(max_length=50, required=False, allow_blank=True)
    module = serializers.CharField(max_length=50, required=False, allow_blank=True)
    result = serializers.ChoiceField(choices=["success", "failure", "denied", ""], required=False)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    page = serializers.IntegerField(min_value=1, required=False)
    page_size = serializers.IntegerField(min_value=1, max_value=100, required=False)
    format = serializers.ChoiceField(choices=["csv", "xlsx"], default="csv")

    def validate(self, values):
        if values.get("date_from") and values.get("date_to") and values["date_from"] > values["date_to"]:
            raise serializers.ValidationError("Période invalide.")
        return values
