from rest_framework import serializers
from apps.companies.serializers import StrictSerializer


class SendEmailInput(StrictSerializer):
    resend = serializers.BooleanField(default=False)
