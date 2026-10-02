from rest_framework import serializers
from apps.companies.serializers import StrictSerializer
from .models import MembershipStatus


class AdminUserInputSerializer(StrictSerializer):
    name = serializers.CharField(min_length=2, max_length=120)
    email = serializers.EmailField()
    department = serializers.CharField(max_length=80)
    role_id = serializers.IntegerField(min_value=1, required=False)
    status = serializers.ChoiceField(choices=MembershipStatus.choices, required=False)

    def validate_email(self, value):
        return value.lower()


class AdminRoleInputSerializer(StrictSerializer):
    name = serializers.CharField(min_length=2, max_length=80)
    description = serializers.CharField(max_length=1000, allow_blank=True)
    permission_codes = serializers.ListField(child=serializers.CharField(max_length=150), max_length=200)
    version = serializers.IntegerField(min_value=1, required=False)

    def validate_permission_codes(self, value):
        return sorted(set(value))
