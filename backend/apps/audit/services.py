from rest_framework.exceptions import PermissionDenied
from .models import AuditLog
from .sanitizers import sanitize


def record_audit_event(*, company, actor, action, entity=None, entity_type=None, entity_id=None, before=None, after=None, metadata=None):
    """Explicit call inside the business transaction. No request bodies, notes or credentials.

    actor is a Membership (not a global User); it must belong to the tenant.
    System scans don't create business mutation events and don't call this service.
    """
    if actor.company_id != company.pk or (entity is not None and getattr(entity, "company_id", company.pk) != company.pk):
        raise PermissionDenied("Contexte d’audit incohérent.")
    reference = getattr(entity, "number", "") if entity is not None else ""
    return AuditLog.objects.create(company=company, actor_id=actor.user_id, action=action,
        entity_type=entity_type or entity._meta.model_name, entity_id=entity_id or getattr(entity, "pk", None), entity_repr=reference[:180],
        before_data=sanitize(before), after_data=sanitize(after), metadata=sanitize(metadata))
