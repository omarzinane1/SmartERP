"""Durable request identities, checked while holding the tenant lock."""
import hashlib
import json
import re
from django.core.serializers.json import DjangoJSONEncoder
from rest_framework.exceptions import ValidationError
from common.exceptions import BusinessConflict


def request_identity(key, data):
    if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z0-9_.:-]{8,128}", key):
        raise ValidationError({"Idempotency-Key": ["Clé de 8 à 128 caractères requise."]})
    encoded = json.dumps(data, cls=DjangoJSONEncoder, sort_keys=True, separators=(",", ":"))
    return key, hashlib.sha256(encoded.encode()).hexdigest()


def replay(query, key, fingerprint):
    existing = query.filter(operation_key=key).first()
    if existing and existing.request_fingerprint != fingerprint:
        raise BusinessConflict("Cette clé d'opération a déjà été utilisée pour une autre demande.")
    return existing
