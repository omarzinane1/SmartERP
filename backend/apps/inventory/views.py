from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.accounts.selectors import get_effective_permission_codes
from apps.purchasing.models import Supplier
from apps.sales.serializers import EmptyActionSerializer
from common.pagination import CollectionPagination
from common.permissions import HasActiveCompany, HasPermission
from . import selectors as read, services, stock, transfer_services
from .models import Product, Warehouse, ProductCategory, UnitOfMeasure
from .serializers import ProductInput, WarehouseInput, ReferenceInput, UnitInput, MovementInput, TransferInput, InventoryFilter
from .valuation import assert_supported_valuation, ZERO


from common.views import CompanyAPIView


class InventoryView(CompanyAPIView):
    def filters(self):
        value = InventoryFilter(data=self.request.query_params)
        value.is_valid(raise_exception=True)
        return value.validated_data

    def suppliers(self):
        return list(Supplier.objects.filter(company=self.request.company, status="active").values("id", "name"))


class ReferenceListView(InventoryView):
    kind = None

    @property
    def required_permission(self):
        return "products.create" if self.request.method == "POST" else "products.view"

    def get(self, request):
        model = ProductCategory if self.kind == "category" else UnitOfMeasure
        return self.page(request, "categories" if self.kind == "category" else "units", list(model.objects.filter(company=request.company).values("id", "name", "code", "is_active")))

    def post(self, request):
        obj = services.create_reference(company=request.company, membership=request.membership,
            model=ProductCategory if self.kind == "category" else UnitOfMeasure,
            data=self.validated(ReferenceInput if self.kind == "category" else UnitInput))
        return Response(dict(id=obj.pk, name=obj.name, code=obj.code, is_active=obj.is_active), status=201)


class ProductListView(InventoryView):
    @property
    def required_permission(self):
        return "products.create" if self.request.method == "POST" else "products.view"

    def get(self, request):
        context, filters = read.stock_context(request.company), self.filters()
        if "inventory.view" in self.codes():
            assert_supported_valuation(request.company)
        rows = read.catalog_payloads(context, self.codes())
        if filters.get("search"):
            term = filters["search"].casefold()
            rows = [r for r in rows if any(term in str(r[k]).casefold() for k in ("name", "sku", "barcode", "description"))]
        for key, field in [("status", "status"), ("category", "category"), ("stock_status", "stockHealth")]:
            if filters.get(key):
                rows = [r for r in rows if r[field] == filters[key]]
        ordering = filters.get("ordering", "name")
        if ordering.lstrip("-") in {"name", "sku"}:
            rows.sort(key=lambda r: (r[ordering.lstrip("-")], r["id"]), reverse=ordering.startswith("-"))
        return self.page(request, "products", rows, suppliers=self.suppliers(),
            categories=list(ProductCategory.objects.filter(company=request.company, is_active=True).values("id", "name", "code")),
            units=list(UnitOfMeasure.objects.filter(company=request.company, is_active=True).values("id", "name", "code")))

    def post(self, request):
        product = services.save_product(company=request.company, membership=request.membership, data=self.validated(ProductInput))
        return Response(product_detail(request.company, product.pk, self.codes(), self.suppliers()), status=201)


def product_detail(company, pk, codes, suppliers):
    context = read.stock_context(company)
    product = next((p for p in context["products"] if p.pk == pk), None)
    if product is None:
        raise NotFound()
    if "inventory.view" in codes:
        assert_supported_valuation(company)
    sales, purchases = read.product_documents(company, product, codes)
    rows = [dict(id=r["warehouseId"], name=r["warehouseName"], **{f: r[f] for f in ("onHand", "reserved", "available", "incoming", "value")}) for r in read.inventory_rows(context) if r["productId"] == pk] if "inventory.view" in codes else []
    return dict(**read.product_payload(product, codes, context), permissions=codes, asOf=timezone.localdate().isoformat(), suppliers=suppliers, sales=sales, purchases=purchases, warehouses=rows, documents=[],
        categories=list(ProductCategory.objects.filter(company=company, is_active=True).values("id", "name", "code")),
        units=list(UnitOfMeasure.objects.filter(company=company, is_active=True).values("id", "name", "code")))


class ProductDetailView(InventoryView):
    @property
    def required_permission(self):
        return "products.edit" if self.request.method == "PATCH" else "products.view"

    def get(self, request, product_id):
        return Response(product_detail(request.company, product_id, self.codes(), self.suppliers()))

    def patch(self, request, product_id):
        services.scoped(Product, request.company, product_id)
        services.save_product(company=request.company, membership=request.membership, product_id=product_id, data=self.validated(ProductInput, partial=True))
        return self.get(request, product_id)


class ProductHistoryView(InventoryView):
    required_permission = "products.view"

    def get(self, request, product_id):
        from rest_framework.exceptions import PermissionDenied
        if not {"inventory.view", "analytics.view"}.intersection(self.codes()):
            raise PermissionDenied()
        product = services.scoped(Product, request.company, product_id)
        return Response(read.product_history(request.company, product, self.codes()))


class ProductMetricsView(InventoryView):
    required_permission = "products.view"

    def get(self, request, product_id):
        from rest_framework.exceptions import PermissionDenied
        from apps.sales.models import InvoiceLine, CreditNoteLine
        if "analytics.view" not in self.codes():
            raise PermissionDenied()
        product = services.scoped(Product, request.company, product_id)
        query = InvoiceLine.objects.filter(company=request.company, product=product, invoice__company=request.company, invoice__status="posted")
        credit = CreditNoteLine.objects.filter(company=request.company, product=product, credit_note__company=request.company)
        sums = query.aggregate(revenue=Sum("subtotal"), units=Sum("quantity"))
        credits = credit.aggregate(revenue=Sum("subtotal"), units=Sum("quantity"))
        context = read.stock_context(request.company)
        if "inventory.view" in self.codes():
            assert_supported_valuation(request.company)
        payload = read.product_payload(next(p for p in context["products"] if p.pk == product.pk), self.codes(), context)
        return Response(dict(revenue=(sums["revenue"] or ZERO)-(credits["revenue"] or ZERO), unitsSold=(sums["units"] or ZERO)-(credits["units"] or ZERO),
            marginAmount=None, averageCost=payload["averageCost"], stockValue=payload["stockValue"], available=payload["available"]))


class WarehouseListView(InventoryView):
    summary_only = False

    @property
    def required_permission(self):
        return "warehouses.create" if self.request.method == "POST" else "warehouses.view"

    def get(self, request):
        context = read.stock_context(request.company)
        if "inventory.view" in self.codes():
            assert_supported_valuation(request.company)
        rows = [read.warehouse_payload(w, context, self.codes()) for w in context["warehouses"]]
        filters = self.filters()
        if filters.get("search"):
            rows = [r for r in rows if filters["search"].casefold() in (r["name"]+r["reference"]+r["city"]).casefold()]
        return self.page(request, "warehouses", rows)

    def post(self, request):
        warehouse = services.save_warehouse(company=request.company, membership=request.membership, data=self.validated(WarehouseInput))
        return Response(dict(**read.warehouse_payload(warehouse, read.stock_context(request.company), self.codes()), **self.metadata()), status=201)


class WarehouseDetailView(InventoryView):
    part = None

    @property
    def required_permission(self):
        if self.request.method == "PATCH":
            return "warehouses.create"
        return "warehouses.view"

    def get(self, request, warehouse_id):
        from rest_framework.exceptions import PermissionDenied
        warehouse = services.scoped(Warehouse, request.company, warehouse_id)
        codes = self.codes()
        if self.part:
            if "inventory.view" not in codes or (self.part == "movements" and "inventory.movements.view" not in codes):
                raise PermissionDenied()
            assert_supported_valuation(request.company)
        context = read.stock_context(request.company)
        if self.part == "inventory":
            return self.page(request, "rows", [r for r in read.inventory_rows(context) if r["warehouseId"] == warehouse_id])
        if self.part == "movements":
            pager = CollectionPagination()
            rows = pager.paginate_queryset(read.movement_queryset(request.company).filter(warehouse=warehouse), request)
            return Response(pager.envelope(key="movements", rows=[read.movement_payload(m, codes) for m in rows]))
        if self.part == "valuation":
            return Response(read.warehouse_valuation(request.company, warehouse, context))
        if "inventory.view" in codes:
            assert_supported_valuation(request.company)
        return Response(dict(**read.warehouse_payload(warehouse, context, codes), **self.metadata()))

    def patch(self, request, warehouse_id):
        services.save_warehouse(company=request.company, membership=request.membership, warehouse_id=warehouse_id, data=self.validated(WarehouseInput, partial=True))
        return self.get(request, warehouse_id)


class InventorySummaryView(InventoryView):
    required_permission = "inventory.view"
    part = None

    def get(self, request):
        context = read.stock_context(request.company)
        assert_supported_valuation(request.company)
        if self.part == "critical":
            return self.page(request, "rows", read.get_low_stock_products(company=request.company, context=context))
        if self.part == "health":
            from collections import defaultdict
            categories = defaultdict(lambda: ZERO)
            for p in read.catalog_payloads(context, self.codes()):
                categories[p["category"] or "Sans catégorie"] += p["stockValue"] or ZERO
            return Response(dict(categories=[dict(name=k, value=v) for k, v in categories.items()],
                warehouses=[dict(name=w.name, value=sum((s.total_value for (_, wid), s in context["levels"].items() if wid == w.pk), ZERO)) for w in context["warehouses"]]))
        return Response(read.inventory_summary(request.company, self.codes(), context))


class MovementListView(InventoryView):
    recent = False

    @property
    def required_permission(self):
        return "inventory.movements.create" if self.request.method == "POST" else "inventory.movements.view"

    def get(self, request):
        query, filters, codes = read.movement_queryset(request.company), self.filters(), self.codes()
        for key, lookup in [("product", "product_id"), ("warehouse", "warehouse_id"), ("date_from", "date__gte"), ("date_to", "date__lte")]:
            if key in filters:
                query = query.filter(**{lookup: filters[key]})
        if filters.get("search"):
            term = filters["search"]
            query = query.filter(Q(number__icontains=term) | Q(source_reference__icontains=term) | Q(product__name__icontains=term) | Q(product__reference__icontains=term))
        if filters.get("type"):
            query = query.filter(movement_type__in=[k for k, v in read.MOVEMENT_TYPES.items() if v == filters["type"]])
        if filters.get("ordering") in {"date", "-date", "reference", "-reference"}:
            query = query.order_by(filters["ordering"].replace("reference", "number"), "pk")
        if self.recent:
            return Response([read.movement_payload(m, codes) for m in query[:8]])
        pager = CollectionPagination()
        rows = pager.paginate_queryset(query, request)
        context = read.stock_context(request.company)
        return Response(pager.envelope(key="movements", rows=[read.movement_payload(m, codes) for m in rows], **self.metadata(),
            products=read.catalog_payloads(context, codes), stock=read.inventory_rows(context) if "inventory.view" in codes or "inventory.movements.create" in codes else [],
            warehouses=[dict(id=w.pk, name=w.name) for w in context["warehouses"] if w.is_active]))

    def post(self, request):
        obj = stock.create_stock_movement(company=request.company, membership=request.membership, data=self.validated(MovementInput), key=request.headers.get("Idempotency-Key"))
        return Response(read.movement_payload(read.movement_queryset(request.company).get(pk=obj.pk), self.codes()), status=201)


class MovementDetailView(InventoryView):
    required_permission = "inventory.movements.view"

    def get(self, request, movement_id):
        obj = read.movement_queryset(request.company).filter(pk=movement_id).first()
        if obj is None:
            raise NotFound()
        return Response(read.movement_payload(obj, self.codes()))


class TransferListView(InventoryView):
    @property
    def required_permission(self):
        return "inventory.transfers.create" if self.request.method == "POST" else "inventory.transfers.view"

    def get(self, request):
        context, codes, filters = read.stock_context(request.company), self.codes(), self.filters()
        query = read.transfer_queryset(request.company)
        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("search"):
            term = filters["search"]
            query = query.filter(Q(number__icontains=term) | Q(reference_external__icontains=term) | Q(source_warehouse__name__icontains=term) | Q(destination_warehouse__name__icontains=term))
        pager = CollectionPagination()
        rows = pager.paginate_queryset(query, request)
        return Response(pager.envelope(key="transfers", rows=[read.transfer_payload(t, codes) for t in rows], **self.metadata(),
            products=read.catalog_payloads(context, codes), stock=read.inventory_rows(context) if "inventory.view" in codes or "inventory.transfers.create" in codes else [],
            warehouses=[dict(id=w.pk, name=w.name) for w in context["warehouses"] if w.is_active], supportsStatusPatch=True))

    def post(self, request):
        obj = transfer_services.create_stock_transfer(company=request.company, membership=request.membership, data=self.validated(TransferInput), key=request.headers.get("Idempotency-Key"))
        return Response(read.transfer_payload(read.transfer_queryset(request.company).get(pk=obj.pk), self.codes()), status=201)


class TransferDetailView(InventoryView):
    @property
    def required_permission(self):
        return "inventory.transfers.create" if self.request.method == "PATCH" else "inventory.transfers.view"

    def get(self, request, transfer_id):
        obj = read.transfer_queryset(request.company).filter(pk=transfer_id).first()
        if obj is None:
            raise NotFound()
        return Response(read.transfer_payload(obj, self.codes()))

    def patch(self, request, transfer_id):
        services.scoped(read.StockTransfer, request.company, transfer_id)
        transfer_services.create_stock_transfer(company=request.company, membership=request.membership, transfer_id=transfer_id, data=self.validated(TransferInput, partial=True))
        return self.get(request, transfer_id)


class TransferActionView(InventoryView):
    required_permission = "inventory.transfers.approve"
    action = None

    def post(self, request, transfer_id):
        self.validated(EmptyActionSerializer)
        obj = transfer_services.transition_stock_transfer(company=request.company, membership=request.membership, transfer_id=transfer_id, action=self.action)
        return Response(read.transfer_payload(read.transfer_queryset(request.company).get(pk=obj.pk), self.codes()))
