from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import NotFound, ValidationError
from apps.accounts.services import require_actor
from apps.companies.models import Company
from apps.companies.sequences import next_document_number
from apps.purchasing.models import Supplier
from common.exceptions import BusinessConflict
from .models import Product, ProductCategory, UnitOfMeasure, ProductPriceRecord, Warehouse, StockLevel


def scoped(model, company, pk, lock=False):
    query = model.objects.filter(company=company, pk=pk)
    obj = (query.select_for_update() if lock else query).first()
    if obj is None:
        raise NotFound()
    return obj


def catalog_reference(model, company, name):
    obj = model.objects.filter(company=company, name=name).first()
    if obj is None:
        if model.objects.filter(company=company, code=name).exists():
            raise BusinessConflict("Ce code de référentiel est déjà utilisé.")
        obj = model.objects.create(company=company, name=name, code=name)
    if not obj.is_active:
        raise ValidationError("Catégorie ou unité inactive.")
    return obj


@transaction.atomic
def create_reference(*, company, membership, model, data):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="products.create")
    code = data.get("code", data["name"])
    if model.objects.filter(company=company).filter(Q(name=data["name"]) | Q(code=code)).exists():
        raise BusinessConflict("Ce nom ou code existe déjà dans cette société.")
    return model.objects.create(company=company, name=data["name"], code=code)


@transaction.atomic
def save_product(*, company, membership, data, product_id=None):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="products.edit" if product_id else "products.create")
    product = scoped(Product, company, product_id, True) if product_id else Product(company=company)
    old_prices = (product.purchase_price, product.unit_price) if product_id else None
    values = dict(data)
    if "reference" in values and Product.objects.filter(company=company, reference=values["reference"]).exclude(pk=product.pk).exists():
        raise BusinessConflict("Ce SKU existe déjà dans cette société.")
    if product_id and "kind" in values and values["kind"] != product.kind:
        raise BusinessConflict("Le type produit/service est immuable.")
    if "supplier_id" in values:
        supplier = scoped(Supplier, company, values.pop("supplier_id"))
        if supplier.status != "active":
            raise ValidationError("Fournisseur non actif.")
        product.supplier = supplier
    for field, model in [("category", ProductCategory), ("unit", UnitOfMeasure)]:
        if field in values:
            obj = catalog_reference(model, company, values.pop(field))
            if field == "unit" and product_id and product.unit_id != obj.pk and product.movements.exists():
                raise BusinessConflict("L'unité ne peut changer après un mouvement de stock.")
            setattr(product, field, obj)
    if "status" in values:
        product.is_active = values.pop("status") == "active"
        if not product.is_active and StockLevel.objects.filter(company=company, product=product, quantity_on_hand__gt=0).exists():
            raise BusinessConflict("Épuisez ou ajustez le stock avant d'archiver le produit.")
    for field, value in values.items():
        setattr(product, field, value)
    if product.maximum_stock and product.maximum_stock < product.minimum_stock:
        raise ValidationError("Le maximum doit être supérieur ou égal au minimum.")
    product.save()
    if old_prices != (product.purchase_price, product.unit_price):
        ProductPriceRecord.objects.create(company=company, product=product, purchase_price=product.purchase_price, selling_price=product.unit_price, created_by_id=membership.user_id)
    return product


@transaction.atomic
def save_warehouse(*, company, membership, data, warehouse_id=None):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="warehouses.create")
    warehouse = scoped(Warehouse, company, warehouse_id, True) if warehouse_id else Warehouse(company=company)
    values = dict(data)
    if "code" in values and Warehouse.objects.filter(company=company, code=values["code"]).exclude(pk=warehouse.pk).exists():
        raise BusinessConflict("Ce code de dépôt existe déjà.")
    if "status" in values:
        warehouse.is_active = values.pop("status") == "active"
        if not warehouse.is_active and (warehouse.stock_levels.filter(quantity_on_hand__gt=0).exists() or warehouse.incoming_transfers.exclude(status__in=["completed", "cancelled"]).exists() or warehouse.outgoing_transfers.exclude(status__in=["completed", "cancelled"]).exists()):
            raise BusinessConflict("Stock ou transfert en cours dans ce dépôt.")
    for field, value in values.items():
        setattr(warehouse, field, value)
    if not warehouse_id and not warehouse.code:
        warehouse.code = next_document_number(company=company, kind="warehouse", prefix="WH", dated=False)
    warehouse.save()
    return warehouse
