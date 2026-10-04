from rest_framework import serializers
from apps.companies.serializers import StrictSerializer


class ApprovalDecisionInput(StrictSerializer):
    comment = serializers.CharField(max_length=2000, allow_blank=True)
    version = serializers.IntegerField(min_value=1)


class ApprovalRequestInput(StrictSerializer):
    type = serializers.ChoiceField(choices=["purchase"])
    record_id = serializers.IntegerField(min_value=1)


class ApprovalFilter(serializers.Serializer):
    search = serializers.CharField(max_length=150, required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=["pending", "approved", "rejected", "cancelled"], required=False)
    type = serializers.ChoiceField(choices=["expense", "purchase"], required=False)
