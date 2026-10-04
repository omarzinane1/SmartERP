from rest_framework import serializers
from apps.companies.serializers import StrictSerializer
from common.dates import company_today


class FinancePeriod(StrictSerializer):
    from_date = serializers.DateField(required=False)
    to_date = serializers.DateField(required=False)

    def validate(self, values):
        today = company_today(self.context["company"])
        start = values.get("from_date", today.replace(day=1))
        end = values.get("to_date", today)
        if start > end or end > today:
            raise serializers.ValidationError("Période invalide : début ≤ fin ≤ aujourd'hui.")
        if (end - start).days > 3660:
            raise serializers.ValidationError("La période ne doit pas dépasser dix ans.")
        return dict(from_date=start, to_date=end)
