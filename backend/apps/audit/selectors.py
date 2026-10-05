from zoneinfo import ZoneInfo
from django.db.models import Q
from django.db.models.functions import TruncDate
from .models import AuditLog

DOMAIN = {"invoice": "invoices.view", "creditnote": "invoices.view", "payment": "payments.view", "paymentallocation": "payments.view", "purchaseorder": "purchases.view", "goodsreceipt": "purchases.view", "supplierinvoice": "supplier_invoices.view", "stocktransfer": "inventory.transfers.view", "expense": "expenses.view", "approvalrequest": "approvals.view", "document": "documents.view", "membership": "users.manage", "role": "roles.manage", "company": "settings.view", "quote": "quotes.view", "salesorder": "sales.view"}


def audit_queryset(company, params):
    query = AuditLog.objects.filter(company=company).select_related("actor")
    for key in ["action", "entity_type"]:
        if params.get(key):
            query = query.filter(**{key: params[key]})
    if params.get("actor"):
        term = params["actor"]
        query = query.filter(actor_id=int(term)) if term.isdecimal() else query.filter(actor__email__icontains=term)
    if params.get("module"):
        query = query.filter(action__startswith=params["module"]+".")
    if params.get("result") in {"failure", "denied"}:
        query = query.none()  # This ledger records committed business actions only.
    if params.get("search"):
        term = params["search"]
        query = query.filter(Q(action__icontains=term) | Q(entity_repr__icontains=term) | Q(actor__email__icontains=term))
    query = query.annotate(day=TruncDate("timestamp", tzinfo=ZoneInfo(company.timezone)))
    for key, lookup in [("date_from", "gte"), ("date_to", "lte")]:
        if params.get(key):
            query = query.filter(**{f"day__{lookup}": params[key]})
    return query


def audit_payload(obj, permissions):
    restricted = DOMAIN.get(obj.entity_type) not in permissions
    return dict(id=obj.pk, timestamp=obj.timestamp.isoformat(), actor=obj.actor.email if obj.actor else "Utilisateur supprimé", module=obj.action.split(".")[0], action=obj.action,
        entityType=obj.entity_type if not restricted else "Restreint", recordId=obj.entity_id if not restricted else None, reference=obj.entity_repr if not restricted else "Restreint", result="success", ip=None, device=None, requestId=None,
        before=obj.before_data if not restricted else {}, after=obj.after_data if not restricted else {}, metadata=obj.metadata if not restricted else {}, restricted=restricted, canOpenRecord=False)
