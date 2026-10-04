from rest_framework import serializers
from apps.companies.serializers import StrictSerializer
from .registry import DATASETS


class ExportInput(StrictSerializer):
    format = serializers.ChoiceField(choices=["csv", "xlsx"], default="csv")
    search = serializers.CharField(max_length=150, allow_blank=True, required=False)
    status = serializers.CharField(max_length=30, allow_blank=True, required=False)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    ids = serializers.ListField(child=serializers.IntegerField(min_value=1), max_length=10000, required=False)

    def validate(self, values):
        if values.get("date_from") and values.get("date_to") and values["date_from"] > values["date_to"]:
            raise serializers.ValidationError("La date de début doit précéder la date de fin.")
        return values


class GenerateExportInput(ExportInput):
    report_id = serializers.ChoiceField(choices=list(DATASETS))
    filter = serializers.CharField(max_length=150, allow_blank=True, default="")
