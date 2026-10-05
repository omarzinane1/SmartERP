"""Tenant-scoped analytical datasets. Aggregates and filtering execute in SQL.

The normalized projection is shared by tables, charts and streamed exports.
Current balances/catalog/stock are explicitly snapshots, never historical stock.
"""
from datetime import timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo
from django.db.models import Avg, Case, CharField, Count, DateField, DecimalField, F, OuterRef, Q, Subquery, Sum, Value, When
from django.db.models.functions import Cast, Coalesce, TruncDate, TruncDay, TruncMonth, TruncWeek
from rest_framework import serializers
from rest_framework.exceptions import NotFound, PermissionDenied
from apps.companies.serializers import StrictSerializer
from apps.finance.summary_selectors import completed_payments, eligible_invoices
from common.dates import company_today

MONEY = DecimalField(max_digits=30, decimal_places=6)
ZERO = Decimal("0")
SPECS = {
    "sales": ("Commandes clients confirmées", {"sales.view"}, False, "Commandes HT", "/sales"),
    "profitability": ("Rentabilité — coûts historiques indisponibles", {"sales.view"}, False, "Commandes HT", "/sales"),
    "purchases": ("Achats confirmés", {"purchases.view"}, False, "Commandes TTC", "/purchases"),
    "invoices": ("Créances clients", {"invoices.view"}, True, "Reste dû TTC", "/invoices"),
    "customers": ("Créances par client", {"invoices.view", "customers.view"}, True, "Reste dû TTC", "/invoices"),
    "payments": ("Paiements confirmés", {"payments.view"}, False, "Flux signé", "/payments"),
    "cash-flow": ("Flux de trésorerie", {"cashflow.view", "finance.view"}, False, "Flux net confirmé", "/payments"),
    "expenses": ("Dépenses approuvées", {"expenses.view"}, False, "Dépenses TTC", "/expenses"),
    "inventory": ("Valorisation du stock actuel", {"inventory.view"}, True, "Valeur HT", "/products"),
    "products": ("Catalogue produits", {"products.view"}, True, "Prix catalogue HT", "/products"),
    "suppliers": ("Achats par fournisseur", {"suppliers.view", "purchases.view"}, True, "Achats confirmés TTC", "/suppliers"),
}


class AnalyticsInput(StrictSerializer):
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    group_by = serializers.ChoiceField(choices=["day", "week", "month"], default="month")
    ordering = serializers.ChoiceField(choices=["date", "-date", "amount", "-amount", "name", "-name"], default="-date")
    search = serializers.CharField(max_length=150, required=False, allow_blank=True)
    partner = serializers.CharField(max_length=150, required=False, allow_blank=True)
    owner = serializers.CharField(max_length=150, required=False, allow_blank=True)
    category = serializers.CharField(max_length=150, required=False, allow_blank=True)
    warehouse = serializers.CharField(max_length=150, required=False, allow_blank=True)
    page = serializers.IntegerField(min_value=1, required=False)
    page_size = serializers.IntegerField(min_value=1, max_value=100, required=False)
    format = serializers.ChoiceField(choices=["csv", "xlsx"], default="csv")

    def validate(self, values):
        today = company_today(self.context["company"])
        values.setdefault("date_to", today)
        values.setdefault("date_from", values["date_to"].replace(day=1))
        if values["date_from"] > values["date_to"] or (values["date_to"]-values["date_from"]).days > 3660:
            raise serializers.ValidationError("Période invalide (maximum dix ans).")
        return values


def report_spec(kind, permissions):
    if kind not in SPECS:
        raise NotFound()
    spec = SPECS[kind]
    if not ({"reports.view"} | spec[1]).issubset(permissions):
        raise PermissionDenied()
    return spec


def text(field):
    return Coalesce(Cast(F(field), CharField()), Value(""))


def summed_subquery(query, parent, field):
    return Coalesce(Subquery(query.filter(**{parent: OuterRef("pk")}).order_by().values(parent).annotate(v=Sum(field)).values("v"), output_field=MONEY), Value(ZERO), output_field=MONEY)


def base_dataset(company, kind, permissions):
    from apps.sales.models import SalesOrder, SalesOrderLine
    from apps.purchasing.models import PurchaseOrder, PurchaseOrderLine, Supplier
    from apps.finance.models import Expense
    from apps.inventory.models import Product, StockLevel
    today = company_today(company)
    fields = {key: Value("", output_field=CharField()) for key in ["reference", "name", "group", "owner", "partner", "category", "warehouse"]}
    fields.update(date=Value(today, output_field=DateField()), amount=Value(ZERO, output_field=MONEY), quantity=Value(None, output_field=MONEY), rid=F("pk"))
    source = "Situation actuelle ; aucune reconstitution historique."
    if kind in {"sales", "profitability"}:
        query = SalesOrder.objects.filter(company=company, customer__company=company, salesperson__company=company, currency=company.currency, status__in=["confirmed", "processing", "completed"])
        fields.update(reference=F("number"), name=F("customer__name"), date=TruncDate("confirmed_at", tzinfo=ZoneInfo(company.timezone)), amount=F("subtotal"), group=F("customer__name"), owner=text("salesperson__user__email"), partner=text("customer_id"), quantity=summed_subquery(SalesOrderLine.objects.filter(company=company), "order_id", "quantity"))
        source = "Commandes confirmées HT, à la date de confirmation dans le fuseau de la société. Ne constitue pas le chiffre d’affaires facturé. Coût des ventes et marge indisponibles."
    elif kind == "purchases":
        query = PurchaseOrder.objects.filter(company=company, supplier__company=company, buyer__company=company, warehouse__company=company, currency=company.currency, status="confirmed")
        fields.update(reference=F("number"), name=F("supplier__name"), date=F("date"), amount=F("total"), group=F("supplier__name"), partner=text("supplier_id"), owner=text("buyer__user__email"), warehouse=F("warehouse__name"), quantity=summed_subquery(PurchaseOrderLine.objects.filter(company=company), "order_id", "quantity"))
        source = "Commandes fournisseurs confirmées TTC, selon la date de commande. Les réceptions et factures ne sont pas additionnées aux commandes."
    elif kind in {"invoices", "customers"}:
        query = eligible_invoices(company).filter(balance_due__gt=0, salesperson__company=company)
        fields.update(reference=F("number"), name=F("customer__name"), date=F("due_date"), amount=F("balance_due"), group=F("customer__name"), partner=text("customer_id"), owner=text("salesperson__user__email"))
    elif kind in {"payments", "cash-flow"}:
        query = completed_payments(company)
        fields.update(reference=F("number"), name=Coalesce("customer__name", "supplier__name"), date=F("date"), amount=Case(When(direction="incoming", then=F("amount")), default=-F("amount"), output_field=MONEY), group=F("direction"), partner=Coalesce("customer__name", "supplier__name"), category=F("method"))
        source = "Paiements confirmés : encaissements positifs, décaissements négatifs. Les annulations sont exclues. Sans solde bancaire initial ni prévision."
    elif kind == "expenses":
        query = Expense.objects.filter(company=company, currency=company.currency, status__in=["approved", "paid"])
        fields.update(reference=F("number"), name=F("description"), date=F("date"), amount=F("total"), group=F("category"), category=F("category"), owner=F("employee"))
        source = "Dépenses approuvées ou payées, TTC, selon leur date. Ces charges ne prouvent pas un décaissement bancaire."
    elif kind == "inventory":
        from apps.inventory.valuation import assert_supported_valuation
        assert_supported_valuation(company)
        query = StockLevel.objects.filter(company=company, product__company=company, warehouse__company=company).filter(Q(product__category__isnull=True) | Q(product__category__company=company))
        fields.update(reference=F("product__reference"), name=F("product__name"), amount=F("total_value"), quantity=F("quantity_on_hand"), group=F("warehouse__name"), warehouse=F("warehouse__name"), category=text("product__category__name"), rid=F("product_id"))
    elif kind == "products":
        query = Product.objects.filter(company=company).filter(Q(category__isnull=True) | Q(category__company=company))
        fields.update(reference=F("reference"), name=F("name"), amount=F("unit_price"), category=text("category__name"), group=text("category__name"))
        source = "Prix catalogue HT actuels ; le KPI est une moyenne, pas un chiffre d’affaires. Quantités disponibles dans le rapport Stock."
    else:
        query = Supplier.objects.filter(company=company, buyer__company=company)
        orders = PurchaseOrder.objects.filter(company=company, currency=company.currency, status="confirmed")
        fields.update(reference=F("reference"), name=F("name"), amount=summed_subquery(orders, "supplier_id", "total"), category=F("category"), group=F("category"), owner=text("buyer__user__email"))
        source = "Fournisseurs actuels et total TTC de leurs commandes confirmées, toutes dates confondues."
    return query.annotate(**{f"r_{key}": value for key, value in fields.items()}), source


def filtered_dataset(company, kind, permissions, params):
    spec = report_spec(kind, permissions)
    query, source = base_dataset(company, kind, permissions)
    if not spec[2]:
        query = query.filter(r_date__range=(params["date_from"], params["date_to"]))
    for key in ["partner", "owner", "category", "warehouse"]:
        if params.get(key):
            query = query.filter(**{f"r_{key}": params[key]})
    if params.get("search"):
        query = query.filter(Q(r_reference__icontains=params["search"]) | Q(r_name__icontains=params["search"]))
    return query, source


def summary(query, kind):
    return query.aggregate(amount=(Avg("r_amount") if kind == "products" else Sum("r_amount", default=ZERO)), count=Count("pk"))


def row_payload(row, path):
    return dict(id=str(row["pk"]), reference=row["r_reference"], name=row["r_name"], date=row["r_date"], amount=row["r_amount"], quantity=row["r_quantity"], group=row["r_group"], owner=row["r_owner"], path=f"{path}/{row['r_rid']}" if path not in {"/payments", "/expenses"} else path,
                dimensions={key: row[f"r_{key}"] for key in ["partner", "category", "warehouse"]})


ROW_FIELDS = ["pk"] + [f"r_{key}" for key in ["rid", "reference", "name", "date", "amount", "quantity", "group", "owner", "partner", "category", "warehouse"]]


def ordered_rows(query, params):
    order = params.get("ordering", "-date")
    return query.order_by(("-" if order.startswith("-") else "") + "r_" + order.lstrip("-"), "pk").values(*ROW_FIELDS)


def report_metadata(company, kind, permissions, params, query, source):
    spec = report_spec(kind, permissions)
    total = summary(query, kind)
    span = params["date_to"]-params["date_from"]+timedelta(days=1)
    previous_params = {**params, "date_from": params["date_from"]-span, "date_to": params["date_from"]-timedelta(days=1)}
    previous = None if spec[2] else summary(filtered_dataset(company, kind, permissions, previous_params)[0], kind)
    aggregate = Avg("r_amount") if kind == "products" else Sum("r_amount")
    groups = list(query.order_by().values("r_group").annotate(value=aggregate, count=Count("pk")).order_by("-value", "r_group")[:20])
    breakdown = [dict(name=row["r_group"] or "Non renseigné", value=row["value"], count=row["count"]) for row in groups]
    remaining = total["count"]-sum(row["count"] for row in groups)
    if remaining:
        # Preserve totals for the bounded breakdown, including signed cash flows.
        omitted = (total["amount"] or ZERO) - sum((row["value"] for row in groups), ZERO) if kind != "products" else ((total["amount"] or ZERO)*total["count"] - sum((row["value"]*row["count"] for row in groups), ZERO))/remaining
        breakdown.append(dict(name="Autres", value=omitted, count=remaining))
    series = []
    if not spec[2]:
        trunc = {"day": TruncDay, "week": TruncWeek, "month": TruncMonth}[params["group_by"]]
        series = [dict(name=row["bucket"].isoformat(), value=row["value"]) for row in query.order_by().annotate(bucket=trunc("r_date")).values("bucket").annotate(value=Sum("r_amount")).order_by("bucket")]
    filters = []
    for key, label in [("partner", "Partenaire"), ("owner", "Responsable"), ("category", "Catégorie"), ("warehouse", "Entrepôt")]:
        values = list(query.exclude(**{f"r_{key}": ""}).order_by(f"r_{key}").values_list(f"r_{key}", flat=True).distinct()[:501])
        if values:
            filters.append(dict(key=key, label=label, options=[dict(value=value, label=value) for value in values[:500]], truncated=len(values)>500))
    kpis = [dict(label=("Prix moyen HT" if kind == "products" else spec[3]), value=total["amount"], previous=previous["amount"] if previous else None, unit="money", improvement="neutral"), dict(label="Enregistrements", value=total["count"], previous=previous["count"] if previous else None, unit="number", improvement="neutral")]
    if kind == "profitability":
        kpis.append(dict(label="Marge", value=None, previous=None, unit="percent", improvement="neutral"))
    return dict(type=kind, title=spec[0], snapshot=spec[2], amountLabel=spec[3], quantityLabel="Quantité (unité de la ligne)", source=source, summary=total, series=series, breakdown=breakdown,
                groupBy=params["group_by"], period=dict(dateFrom=params["date_from"], dateTo=params["date_to"], **{key: params.get(key, "") for key in ["partner", "owner", "category", "warehouse"]}), previousPeriod=dict(dateFrom=previous_params["date_from"], dateTo=previous_params["date_to"]),
                kpis=kpis, charts=[dict(title="Répartition (20 premiers groupes et autres)", data=breakdown)] + ([dict(title="Évolution", data=series)] if series else []), filters=filters, formats=["csv", "xlsx"] if "reports.export" in permissions else [])
