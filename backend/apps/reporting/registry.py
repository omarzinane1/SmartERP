"""Explicit export columns; credentials and internal fields never enter a dataset."""
from dataclasses import dataclass
from django.apps import apps
from django.db.models import Q
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError


@dataclass(frozen=True)
class Dataset:
    model: str
    title: str
    view: str
    export: str
    columns: tuple
    date: str
    search: tuple
    path: str
    partner: str = ""


DATASETS = {
    "customers": Dataset("crm.Customer", "Clients", "customers.view", "customers.export", (("reference", "Référence"), ("name", "Nom"), ("email", "E-mail"), ("phone", "Téléphone"), ("city", "Ville"), ("status", "Statut"), ("created_at", "Créé le")), "created_at", ("reference", "name", "email"), "/customers"),
    "suppliers": Dataset("purchasing.Supplier", "Fournisseurs", "suppliers.view", "suppliers.export", (("reference", "Référence"), ("name", "Nom"), ("email", "E-mail"), ("phone", "Téléphone"), ("category", "Catégorie"), ("city", "Ville"), ("status", "Statut")), "created_at", ("reference", "name", "email"), "/suppliers"),
    "quotes": Dataset("sales.Quote", "Devis", "quotes.view", "quotes.export", (("number", "Référence"), ("customer__name", "Client"), ("issue_date", "Date"), ("expires_at", "Expiration"), ("status", "Statut"), ("subtotal", "HT"), ("tax_total", "Taxes"), ("total", "TTC"), ("currency", "Devise")), "issue_date", ("number", "customer__name"), "/quotes", "customer"),
    "invoices": Dataset("sales.Invoice", "Factures clients", "invoices.view", "reports.export", (("number", "Référence"), ("customer__name", "Client"), ("issue_date", "Date"), ("due_date", "Échéance"), ("status", "Statut"), ("subtotal", "HT"), ("tax_total", "Taxes"), ("total", "TTC"), ("amount_paid", "Payé"), ("credit_total", "Avoirs"), ("balance_due", "Reste dû"), ("currency", "Devise")), "issue_date", ("number", "customer__name"), "/invoices", "customer"),
    "payments": Dataset("finance.Payment", "Paiements", "payments.view", "payments.export", (("number", "Référence"), ("date", "Date"), ("direction", "Sens"), ("customer__name", "Client"), ("supplier__name", "Fournisseur"), ("amount", "Montant"), ("currency", "Devise"), ("method", "Méthode"), ("status", "Statut"), ("reference_external", "Référence externe")), "date", ("number", "customer__name", "supplier__name", "reference_external"), "/payments"),
    "products": Dataset("inventory.Product", "Produits", "products.view", "products.export", (("reference", "SKU"), ("name", "Nom"), ("kind", "Type"), ("purchase_price", "Prix achat HT"), ("unit_price", "Prix vente HT"), ("tax_rate", "TVA %"), ("minimum_stock", "Stock minimum"), ("maximum_stock", "Stock maximum"), ("is_active", "Actif")), "created_at", ("reference", "name", "barcode"), "/products"),
    "expenses": Dataset("finance.Expense", "Dépenses", "expenses.view", "expenses.export", (("number", "Référence"), ("date", "Date"), ("description", "Description"), ("category", "Catégorie"), ("employee", "Employé"), ("amount_ht", "HT"), ("tax_amount", "Taxes"), ("total", "TTC"), ("currency", "Devise"), ("status", "Statut")), "date", ("number", "description", "employee"), "/expenses"),
    "purchases": Dataset("purchasing.PurchaseOrder", "Commandes fournisseurs", "purchases.view", "reports.export", (("number", "Référence"), ("date", "Date"), ("expected_date", "Livraison prévue"), ("supplier__name", "Fournisseur"), ("status", "Statut"), ("subtotal", "HT"), ("tax_total", "Taxes"), ("total", "TTC"), ("currency", "Devise")), "date", ("number", "supplier__name"), "/purchases", "supplier"),
    "supplier-invoices": Dataset("purchasing.SupplierInvoice", "Factures fournisseurs", "supplier_invoices.view", "reports.export", (("number", "Référence"), ("supplier_reference", "Référence fournisseur"), ("supplier__name", "Fournisseur"), ("issue_date", "Date"), ("due_date", "Échéance"), ("status", "Statut"), ("subtotal", "HT"), ("tax_total", "Taxes"), ("total", "TTC"), ("amount_paid", "Payé"), ("balance_due", "Reste dû"), ("currency", "Devise")), "issue_date", ("number", "supplier_reference", "supplier__name"), "/supplier-invoices", "supplier"),
    "sales": Dataset("sales.SalesOrder", "Commandes clients", "sales.view", "reports.export", (("number", "Référence"), ("created_at", "Créée le"), ("customer__name", "Client"), ("status", "Statut"), ("subtotal", "HT"), ("tax_total", "Taxes"), ("total", "TTC"), ("currency", "Devise")), "created_at", ("number", "customer__name"), "/sales", "customer"),
    "inventory": Dataset("inventory.StockLevel", "Stock et valorisation", "inventory.view", "inventory.export", (("product__reference", "SKU"), ("product__name", "Produit"), ("warehouse__name", "Entrepôt"), ("quantity", "Quantité"), ("total_value", "Valeur HT MAD")), "", ("product__reference", "product__name", "warehouse__name"), "/inventory"),
}


def dataset_spec(entity, permissions):
    if entity not in DATASETS:
        raise NotFound()
    spec = DATASETS[entity]
    if not {spec.view, spec.export}.issubset(permissions):
        raise PermissionDenied()
    return spec


def dataset_query(company, spec, filters):
    query = apps.get_model(spec.model).objects.filter(company=company)
    if spec.partner:
        query = query.filter(**{f"{spec.partner}__company": company})
    if spec.model == "finance.Payment":
        query = query.filter(Q(customer__company=company, direction="incoming") | Q(supplier__company=company, direction="outgoing"))
    if spec.model == "inventory.StockLevel":
        from apps.inventory.valuation import assert_supported_valuation
        assert_supported_valuation(company)
        query = query.filter(product__company=company, warehouse__company=company)
    if filters.get("date_from") or filters.get("date_to"):
        if not spec.date:
            raise ValidationError("Ce jeu de données représente la situation actuelle et ne supporte pas une période historique.")
        field = spec.date + ("__date" if spec.date.endswith("_at") else "")
        for key, lookup in [("date_from", "gte"), ("date_to", "lte")]:
            if filters.get(key):
                query = query.filter(**{f"{field}__{lookup}": filters[key]})
    if filters.get("search"):
        condition = Q(pk__in=[])
        for field in spec.search:
            condition |= Q(**{f"{field}__icontains": filters["search"]})
        query = query.filter(condition)
    if "ids" in filters:
        query = query.filter(pk__in=filters["ids"])
    if filters.get("status"):
        fields = {field.name for field in query.model._meta.fields}
        if "status" not in fields:
            raise ValidationError("Filtre de statut non pris en charge.")
        query = query.filter(status=filters["status"])
    return query.order_by("pk")


def dataset_rows(company, spec, filters):
    # values_list prevents relation N+1 queries and iterator avoids a result cache.
    query = dataset_query(company, spec, filters)
    return query.values_list(*[field for field, _ in spec.columns]).iterator(chunk_size=2000)
