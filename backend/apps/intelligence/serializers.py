from rest_framework import serializers
from apps.companies.serializers import StrictSerializer
from .constants import STATUSES, SEVERITIES, RULE_PERMISSIONS


class AlertFilters(StrictSerializer):
    status = serializers.ChoiceField(choices=[*STATUSES, "investigating"], required=False)
    severity = serializers.ChoiceField(choices=[*SEVERITIES, "opportunity"], required=False)
    alert_type = serializers.ChoiceField(choices=list(RULE_PERMISSIONS), required=False)
    type = serializers.ChoiceField(choices=["fact", "analysis", "forecast", "recommendation"], required=False)
    department = serializers.ChoiceField(choices=["Finance", "Clients", "Stock", "Ventes", "Achats", "Opérations"], required=False)
    search = serializers.CharField(max_length=150, allow_blank=True, required=False)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    days = serializers.IntegerField(min_value=1, max_value=366, required=False)
    page = serializers.IntegerField(min_value=1, required=False)
    page_size = serializers.IntegerField(min_value=1, max_value=100, required=False)
    ordering = serializers.ChoiceField(choices=["date", "severity", "department"], required=False, default="date")

    def validate(self, data):
        if data.get("date_from") and data.get("date_to") and data["date_from"] > data["date_to"]:
            raise serializers.ValidationError("Période inversée.")
        return data


class EmptyAction(StrictSerializer):
    pass
