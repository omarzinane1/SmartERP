from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.accounts.selectors import get_effective_permission_codes
from apps.crm.selectors import salesperson_name
from apps.inventory.models import Warehouse
from apps.sales.serializers import EmptyActionSerializer
from common.pagination import CollectionPagination
from common.permissions import HasActiveCompany, HasPermission
from . import selectors, services
from .permissions import CanReadPurchases
from .serializers import SupplierInputSerializer, SupplierFilterSerializer, PurchaseInputSerializer, PurchaseFilterSerializer, ReceiptInputSerializer


class PurchasingView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]

    def codes(self):
        return get_effective_permission_codes(membership=self.request.membership)


class SupplierListView(PurchasingView):
    @property
    def required_permission(self):
        return "suppliers.create" if self.request.method == "POST" else "suppliers.view"

    def get(self, request):
        filters = SupplierFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)
        base, codes = selectors.supplier_queryset(request.company), self.codes()
        rows = selectors.filter_suppliers(base, filters.validated_data, codes)
        pager = CollectionPagination()
        page = pager.paginate_queryset(rows, request)
        facets = {"categories": sorted({s.category for s in base}), "countries": sorted({s.country for s in base}), "buyers": sorted({salesperson_name(s.buyer) for s in base})}
        return Response(pager.envelope(key="suppliers", rows=page, totalCount=len(base), summary=selectors.supplier_summary(rows),
            permissions=codes, asOf=timezone.localdate().isoformat(), currentBuyer=salesperson_name(request.membership), facets=facets))

    def post(self, request):
        serializer = SupplierInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        supplier = services.save_supplier(company=request.company, membership=request.membership, data=serializer.validated_data)
        return Response(selectors.supplier_detail(selectors.supplier_by_id(request.company, supplier.pk), self.codes()), status=201)


class SupplierDetailView(PurchasingView):
    @property
    def required_permission(self):
        return "suppliers.edit" if self.request.method == "PATCH" else "suppliers.view"

    def get(self, request, supplier_id):
        return Response(selectors.supplier_detail(selectors.supplier_by_id(request.company, supplier_id), self.codes()))

    def patch(self, request, supplier_id):
        selectors.supplier_by_id(request.company, supplier_id)
        serializer = SupplierInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        services.save_supplier(company=request.company, membership=request.membership, supplier_id=supplier_id, data=serializer.validated_data)
        return Response(selectors.supplier_detail(selectors.supplier_by_id(request.company, supplier_id), self.codes()))


class SupplierMetricsView(PurchasingView):
    required_permission = "suppliers.view"

    def get(self, request, supplier_id):
        return Response(selectors.supplier_metrics(selectors.supplier_by_id(request.company, supplier_id), self.codes()))


class SupplierPriceHistoryView(PurchasingView):
    required_permission = "suppliers.view"
    permission_classes = PurchasingView.permission_classes + [CanReadPurchases]

    def get(self, request, supplier_id):
        return Response(selectors.supplier_price_history(selectors.supplier_by_id(request.company, supplier_id)))


class PurchaseListView(PurchasingView):
    @property
    def required_permission(self):
        return "purchases.create" if self.request.method == "POST" else "purchases.view"

    def get(self, request):
        serializer = PurchaseFilterSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        filters, codes = serializer.validated_data, self.codes()
        query = selectors.purchase_queryset(request.company)
        if filters.get("search"):
            query = query.filter(number__icontains=filters["search"])
        for field in ("supplier_id", "status"):
            if field in filters:
                query = query.filter(**{field: filters[field]})
        pager = CollectionPagination()
        rows = pager.paginate_queryset(query, request)
        return Response(pager.envelope(key="orders", rows=[selectors.purchase_payload(o, codes) for o in rows],
            permissions=codes, asOf=timezone.localdate().isoformat(), currentBuyer=salesperson_name(request.membership), products=selectors.purchase_catalog(request.company),
            suppliers=list(selectors.Supplier.objects.filter(company=request.company, buyer__company=request.company, status="active").values("id", "name")),
            warehouses=list(Warehouse.objects.filter(company=request.company, is_active=True).values("id", "name")), canExport="reports.export" in codes))

    def post(self, request):
        serializer = PurchaseInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = services.save_purchase_order(company=request.company, membership=request.membership, data=serializer.validated_data)
        return Response(selectors.purchase_payload(selectors.purchase_by_id(request.company, order.pk), self.codes(), True), status=201)


class PurchaseDetailView(PurchasingView):
    @property
    def required_permission(self):
        return "purchases.edit" if self.request.method == "PATCH" else "purchases.view"

    def get(self, request, order_id):
        return Response(selectors.purchase_payload(selectors.purchase_by_id(request.company, order_id), self.codes(), True))

    def patch(self, request, order_id):
        selectors.purchase_by_id(request.company, order_id)
        serializer = PurchaseInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        services.save_purchase_order(company=request.company, membership=request.membership, data=serializer.validated_data, order_id=order_id)
        return Response(selectors.purchase_payload(selectors.purchase_by_id(request.company, order_id), self.codes(), True))


class PurchaseActionView(PurchasingView):
    action = None

    @property
    def required_permission(self):
        return {"send": "purchases.edit", "confirm": "purchases.confirm", "cancel": "purchases.edit", "receive": "receipts.create"}[self.action]

    def post(self, request, order_id):
        selectors.purchase_by_id(request.company, order_id)
        serializer = (ReceiptInputSerializer if self.action == "receive" else EmptyActionSerializer)(data=request.data)
        serializer.is_valid(raise_exception=True)
        args = dict(company=request.company, membership=request.membership, order_id=order_id)
        if self.action == "receive":
            services.receive_purchase_order(**args, data=serializer.validated_data, key=request.headers.get("Idempotency-Key"))
        else:
            services.transition_purchase_order(**args, action=self.action)
        return Response(selectors.purchase_payload(selectors.purchase_by_id(request.company, order_id), self.codes(), True))
