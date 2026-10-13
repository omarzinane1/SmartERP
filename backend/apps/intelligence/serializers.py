from rest_framework import serializers
from apps.companies.serializers import StrictSerializer
from .constants import STATUSES, SEVERITIES, RULE_PERMISSIONS


class AlertFilters(StrictSerializer):
    anomaly_type = serializers.ChoiceField(choices=list(RULE_PERMISSIONS), required=False)
    domain = serializers.ChoiceField(choices=["finance", "receivables", "inventory"], required=False)
    source = serializers.ChoiceField(choices=["RULE_BASED", "statistical"], required=False)
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


class RefreshInput(StrictSerializer):
    horizon = serializers.ChoiceField(choices=[7, 30], default=7)
    granularity = serializers.ChoiceField(choices=["day"], default="day")


class ForecastFilters(StrictSerializer):
    metric = serializers.ChoiceField(choices=["revenue", "net_cash_flow"], required=False)
    horizon = serializers.ChoiceField(choices=[7, 30], required=False)
    granularity = serializers.ChoiceField(choices=["day"], required=False)
    page = serializers.IntegerField(min_value=1, required=False)
    page_size = serializers.IntegerField(min_value=1, max_value=100, required=False)


class OpportunityFilters(StrictSerializer):
    from . import opportunity_config as policy
    type = serializers.ChoiceField(choices=list(policy.PERMISSIONS), required=False)
    status = serializers.ChoiceField(choices=policy.STATUSES, required=False)
    priority = serializers.ChoiceField(choices=policy.PRIORITIES, required=False)
    domain = serializers.ChoiceField(choices=sorted(set(policy.DOMAINS.values())), required=False)
    search = serializers.CharField(max_length=150, allow_blank=True, required=False)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    page = serializers.IntegerField(min_value=1, required=False)
    page_size = serializers.IntegerField(min_value=1, max_value=100, required=False)

    def validate(self, data):
        if data.get("date_from") and data.get("date_to") and data["date_from"] > data["date_to"]:
            raise serializers.ValidationError("Période inversée.")
        return data
