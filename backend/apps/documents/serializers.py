from rest_framework import serializers
from apps.companies.serializers import StrictSerializer
from .registry import ENTITIES


class DocumentUpload(StrictSerializer):
    file = serializers.FileField()
    category = serializers.CharField(max_length=80, allow_blank=True, default="")
    department = serializers.CharField(max_length=80, allow_blank=True, default="")
    visibility = serializers.ChoiceField(choices=["Public entreprise", "Privé"], default="Public entreprise")
    entity_type = serializers.ChoiceField(choices=list(ENTITIES), required=False)
    entity_id = serializers.IntegerField(min_value=1, required=False)

    def validate(self, values):
        if ("entity_type" in values) != ("entity_id" in values):
            raise serializers.ValidationError("Type et identifiant de liaison requis ensemble.")
        return values


class DocumentLinkInput(StrictSerializer):
    entity_type = serializers.ChoiceField(choices=list(ENTITIES))
    entity_id = serializers.IntegerField(min_value=1)


class DocumentFilter(serializers.Serializer):
    search = serializers.CharField(max_length=150, allow_blank=True, required=False)
    category = serializers.CharField(max_length=80, required=False)
    department = serializers.CharField(max_length=80, required=False)
    entity_type = serializers.ChoiceField(choices=list(ENTITIES), required=False)
    entity_id = serializers.IntegerField(min_value=1, required=False)
