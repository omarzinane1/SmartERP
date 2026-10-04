from dataclasses import dataclass
from django.apps import apps
from rest_framework.exceptions import ValidationError, NotFound, PermissionDenied


@dataclass(frozen=True)
class Entity:
    model: str
    permission: str
    path: str
    label: str
    reference: str = "number"


ENTITIES = {
    "customer": Entity("crm.Customer", "customers.view", "customers", "Client", "name"),
    "supplier": Entity("purchasing.Supplier", "suppliers.view", "suppliers", "Fournisseur", "name"),
    "quote": Entity("sales.Quote", "quotes.view", "quotes", "Devis"),
    "sales_order": Entity("sales.SalesOrder", "sales.view", "sales", "Commande client"),
    "invoice": Entity("sales.Invoice", "invoices.view", "invoices", "Facture client"),
    "payment": Entity("finance.Payment", "payments.view", "payments", "Paiement"),
    "purchase_order": Entity("purchasing.PurchaseOrder", "purchases.view", "purchases", "Commande fournisseur"),
    "supplier_invoice": Entity("purchasing.SupplierInvoice", "supplier_invoices.view", "supplier-invoices", "Facture fournisseur"),
    "product": Entity("inventory.Product", "products.view", "products", "Produit", "name"),
    "expense": Entity("finance.Expense", "expenses.view", "expenses", "Dépense"),
}


def entity_queryset(company, kind):
    if kind not in ENTITIES:
        raise ValidationError("Type de liaison non pris en charge.")
    return apps.get_model(ENTITIES[kind].model).objects.filter(company=company)


def linked_entity(company, permissions, kind, pk, lock=False):
    query = entity_queryset(company, kind)
    if ENTITIES[kind].permission not in permissions:
        raise PermissionDenied()
    if lock:
        query = query.select_for_update()
    obj = query.filter(pk=pk).first()
    if obj is None:
        raise NotFound()
    return obj


def entity_path(kind, pk):
    path = ENTITIES[kind].path
    return f"/{path}" if kind in {"payment", "expense"} else f"/{path}/{pk}"
