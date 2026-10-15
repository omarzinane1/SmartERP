"""Closed, read-only ERP tool registry. User/tenant context is never a tool argument."""
import json
import logging
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from time import monotonic
from django.db import connection, transaction
from django.db.models import Count, Sum, Max, Q, F
from pydantic import Field, ValidationError
from rest_framework.exceptions import NotFound, PermissionDenied
from apps.accounts.models import Membership
from apps.audit.services import record_audit_event
from apps.companies.models import Company
from common.dates import company_today
from .. import policy
from ..guardrails import ClosedSchema, deadline_check
from ..llm import AIError
from ..selectors import context

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AIToolContext:
    company_id: int
    membership_id: int
    user_id: int
    trace_id: str
    deadline: float

    def actor(self, required=()):
        company = Company.objects.get(pk=self.company_id)
        member = Membership.objects.filter(pk=self.membership_id, company=company, user_id=self.user_id).first()
        member, codes = context(company, member)
        if not set(required).issubset(codes):
            raise PermissionDenied()
        return company, member, codes


def audit(ctx, action, **metadata):
    # The membership may have just been revoked: audit denial without re-authorizing it.
    member = Membership.objects.filter(pk=ctx.membership_id, company_id=ctx.company_id, user_id=ctx.user_id).first()
    record_audit_event(company=Company.objects.get(pk=ctx.company_id), actor=member,
        action=f"intelligence.{action}", entity_type="aiassistant", metadata=dict(trace_id=ctx.trace_id, **metadata))
    logger.info("ai_event trace_id=%s company_id=%s user_id=%s action=%s status=%s", ctx.trace_id, ctx.company_id, ctx.user_id, action, metadata.get("status", ""))


class EmptyArgs(ClosedSchema):
    pass


class PeriodArgs(ClosedSchema):
    from_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    to_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class ListArgs(ClosedSchema):
    limit: int = Field(default=10, ge=1, le=policy.MAX_ROWS)


class CustomerArgs(ClosedSchema):
    customer_id: int = Field(gt=0)


class StockArgs(ListArgs):
    warehouse_id: int | None = Field(default=None, gt=0)


class SupplierArgs(PeriodArgs):
    supplier_id: int = Field(gt=0)


def period(company, args):
    today = company_today(company)
    try:
        start = date.fromisoformat(args.from_date) if args.from_date else today.replace(day=1)
        end = date.fromisoformat(args.to_date) if args.to_date else today
    except ValueError:
        raise AIError("invalid_arguments") from None
    if start > end or (end-start).days > 366 or end > today:
        raise AIError("invalid_arguments")
    return start, end


def revenue(company, codes, args):
    from apps.finance.summary_selectors import get_revenue_summary
    start, end = period(company, args)
    return dict(revenue=get_revenue_summary(company, start, end), currency=company.currency,
        fromDate=start, toDate=end, definition="CA HT des factures comptabilisées, net des avoirs comptabilisés datés sur la période.")


def cash_flow(company, codes, args):
    from apps.finance.summary_selectors import get_cash_flow_summary
    return dict(**get_cash_flow_summary(company, *period(company, args)), currency=company.currency)


def overdue(company, codes, args):
    from apps.finance.summary_selectors import overdue_invoices
    rows = overdue_invoices(company).order_by("due_date", "pk")[:args.limit]
    return dict(invoices=[dict(id=r.pk, reference=r.number, balance=r.balance_due, dueDate=r.due_date) for r in rows], currency=company.currency, asOf=company_today(company), limit=args.limit)


def customer_balance(company, codes, args):
    from apps.crm.selectors import customers_queryset
    from apps.finance.summary_selectors import eligible_invoices
    if not customers_queryset(company).filter(pk=args.customer_id).exists():
        raise NotFound()
    value = eligible_invoices(company).filter(customer_id=args.customer_id).aggregate(balance=Sum("balance_due", default=Decimal(0)))
    return dict(customerId=args.customer_id, currency=company.currency, **value)


def low_stock(company, codes, args):
    from apps.inventory.models import Warehouse
    from apps.inventory.selectors import low_stock_queryset
    warehouses = Warehouse.objects.filter(company=company, is_active=True).order_by("pk")
    if args.warehouse_id:
        warehouses = warehouses.filter(pk=args.warehouse_id)
    warehouses = list(warehouses[:51])
    if args.warehouse_id and not warehouses:
        raise NotFound()
    if len(warehouses) > 50:
        raise AIError("warehouse_filter_required")
    result = []
    for warehouse in warehouses:
        rows = low_stock_queryset(company, warehouse).order_by("available_stock", "pk")[:args.limit-len(result)]
        result.extend(dict(id=r.pk, warehouseId=warehouse.pk, name=r.name[:150], available=r.available_stock, minimum=r.minimum_stock) for r in rows)
        if len(result) >= args.limit:
            break
    return dict(products=result, limit=args.limit)


def supplier_performance(company, codes, args):
    from apps.purchasing.selectors import supplier_queryset, purchase_queryset
    from apps.purchasing.models import GoodsReceipt
    if not supplier_queryset(company).filter(pk=args.supplier_id).exists():
        raise NotFound()
    start, end = period(company, args)
    orders = purchase_queryset(company).filter(supplier_id=args.supplier_id, status="confirmed", date__range=(start, end)).prefetch_related(None)
    receipts = GoodsReceipt.objects.filter(company=company, order_id__in=orders.values("pk"), supplier_id=args.supplier_id,
        supplier__company=company, warehouse__company=company, order__supplier_id=F("supplier_id"))
    values = receipts.aggregate(receipts=Count("pk"), lateReceipts=Count("pk", filter=Q(date__gt=F("order__expected_date"))))
    return dict(supplierId=args.supplier_id, fromDate=start, toDate=end, confirmedOrders=orders.count(), **values,
        definition="Réceptions enregistrées comparées à la date prévue des commandes confirmées de la période ; ce n'est pas un taux de livraison complète.")


def health(company, codes, args):
    from ..health import business_health
    from apps.inventory.models import Warehouse
    if Warehouse.objects.filter(company=company, is_active=True).count() > 50:
        raise AIError("tool_data_limit")
    permitted = set(codes)
    if "ai.tools.finance" not in codes:
        permitted -= {"invoices.view", "finance.view", "cashflow.view", "expenses.view", "supplier_invoices.view"}
    if "ai.tools.inventory" not in codes:
        permitted -= {"inventory.view", "products.view"}
    return business_health(company, permitted)


@dataclass(frozen=True)
class ToolSpec:
    name: str
    label: str
    schema: type
    permissions: tuple
    handler: object
    mode: str = "read"


TOOLS = {s.name: s for s in (
    ToolSpec("revenue", "Chiffre d'affaires HT", PeriodArgs, ("ai.tools.finance", "invoices.view",), revenue),
    ToolSpec("cash_flow", "Flux de trésorerie", PeriodArgs, ("ai.tools.finance", "finance.view", "cashflow.view"), cash_flow),
    ToolSpec("overdue_invoices", "Factures échues", ListArgs, ("ai.tools.finance", "invoices.view",), overdue),
    ToolSpec("customer_balance", "Créance client", CustomerArgs, ("ai.tools.finance", "customers.view", "invoices.view"), customer_balance),
    ToolSpec("low_stock", "Stocks au seuil", StockArgs, ("ai.tools.inventory", "inventory.view", "products.view"), low_stock),
    ToolSpec("supplier_performance", "Délais fournisseurs", SupplierArgs, ("suppliers.view", "purchases.view"), supplier_performance),
    ToolSpec("business_health", "Santé de l'entreprise", EmptyArgs, (), health),
)}


def available_tools(codes):
    return [s for s in TOOLS.values() if "ai.use" in codes and set(s.permissions).issubset(codes)]


def execute_tool(ctx, name, arguments):
    deadline_check(ctx.deadline)
    started = monotonic()
    # Do not log unknown names or arguments: both contain untrusted text.
    spec = TOOLS.get(name)
    try:
        if spec is None:
            raise AIError("tool_not_found")
        company, member, codes = ctx.actor(spec.permissions)
        args = spec.schema.model_validate(arguments)
        tool_deadline = min(ctx.deadline, monotonic()+policy.SQL_TIMEOUT_MS/1000)

        def bounded_query(execute, sql, params, many, context):
            deadline_check(tool_deadline)
            execute("SELECT set_config('statement_timeout', %s, true)", [str(max(1, int((tool_deadline-monotonic())*1000)))], False, context)
            value = execute(sql, params, many, context)
            deadline_check(tool_deadline)
            return value

        with transaction.atomic():
            with connection.execute_wrapper(bounded_query):
                result = spec.handler(company, codes, args)
            result["company"] = company.name
            encoded = json.dumps(result, default=str, ensure_ascii=False)
            if len(encoded.encode()) > policy.MAX_OUTPUT_BYTES:
                raise AIError("tool_output_limit")
        ctx.actor(spec.permissions)
        audit(ctx, "tool_executed", tool=spec.name, status="completed", duration_ms=int((monotonic()-started)*1000))
        # For permission-scoped health store all current source permissions, so revocation masks history.
        required = list(spec.permissions) if name != "business_health" else [c for c in codes if c.endswith(".view") or c.startswith("ai.tools.")]
        return dict(tool=name, data=json.loads(encoded), required_permissions=required)
    except (PermissionDenied, NotFound, ValidationError, AIError) as error:
        code = "permission_denied" if isinstance(error, PermissionDenied) else "not_found" if isinstance(error, NotFound) else "invalid_arguments" if isinstance(error, ValidationError) else error.code
        audit(ctx, "tool_denied", tool=spec.name if spec else "unknown", error_code=code)
        raise AIError(code) from None
    except Exception:
        audit(ctx, "tool_denied", tool=spec.name if spec else "unknown", error_code="tool_failed")
        raise AIError("tool_failed") from None
