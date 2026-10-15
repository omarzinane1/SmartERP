"""Keep only deliberately supported scalar business fields; never serialize requests."""
from datetime import date, datetime
from decimal import Decimal

FIELDS = {"status", "total", "subtotal", "balance_due", "amount", "currency", "direction", "version", "settings_version", "section", "permission_codes", "permission", "role_id", "membership_id", "workflow_type", "invoice_id", "supplier_invoice_id", "payment_id", "order_id", "document_id", "visibility", "size", "mime_type", "deleted", "is_active", "entity_type", "entity_id", "number", "before_status", "after_status", "role_ids"}


FIELDS.update({"email_id", "email_type", "backend", "error_code"})
FIELDS.update({"run_id"})
FIELDS.update({"trace_id", "conversation_id", "tool", "route", "duration_ms", "chunk_count"})


def safe_value(value):
    if value is None or isinstance(value, (bool, int)):
        return value
    if isinstance(value, (date, datetime, Decimal)):
        return str(value)
    if isinstance(value, str):
        return value[:250]
    if isinstance(value, (list, tuple)):
        return [safe_value(item) for item in value[:100] if not isinstance(item, dict)]
    return None


def sanitize(values):
    return {key: safe_value(value) for key, value in (values or {}).items() if key in FIELDS}
