from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.accounts.selectors import get_effective_permission_codes
from common.pagination import CollectionPagination
from common.permissions import HasActiveCompany, HasPermission
from . import order_selectors as selectors, order_services as services
from .order_serializers import QuoteConversionSerializer, SalesOrderFilterSerializer, SalesOrderInputSerializer
from .serializers import EmptyActionSerializer


class QuoteConversionView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]
    required_permission = "quotes.convert"

    def post(self, request, quote_id):
        serializer = QuoteConversionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = services.convert_quote(company=request.company, membership=request.membership, quote_id=quote_id)
        return Response(dict(id=order.pk, reference=order.number, target="sales_order"), status=201)


class SalesOrderListView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]

    @property
    def required_permission(self):
        return "sales.edit" if self.request.method == "POST" else "sales.view"

    def get(self, request):
        filters = SalesOrderFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)
        query = selectors.filter_orders(selectors.order_queryset(request.company), filters.validated_data, company=request.company)
        pager = CollectionPagination()
        rows = pager.paginate_queryset(query, request)
        return Response(pager.envelope(key="orders", rows=[selectors.order_payload(o) for o in rows],
                                      permissions=get_effective_permission_codes(membership=request.membership), asOf=timezone.localdate().isoformat()))

    def post(self, request):
        serializer = SalesOrderInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = services.save_sales_order(company=request.company, membership=request.membership, data=serializer.validated_data)
        return Response(selectors.order_detail(order=selectors.order_by_id(company=request.company, order_id=order.pk), membership=request.membership), status=201)


class SalesOrderDetailView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]

    @property
    def required_permission(self):
        return "sales.edit" if self.request.method == "PATCH" else "sales.view"

    def get(self, request, order_id):
        return Response(selectors.order_detail(order=selectors.order_by_id(company=request.company, order_id=order_id), membership=request.membership))

    def patch(self, request, order_id):
        selectors.order_by_id(company=request.company, order_id=order_id)
        serializer = SalesOrderInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        order = services.save_sales_order(company=request.company, membership=request.membership, data=serializer.validated_data, order_id=order_id)
        return Response(selectors.order_detail(order=selectors.order_by_id(company=request.company, order_id=order.pk), membership=request.membership))


class SalesOrderActionView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]
    required_permission = "sales.edit"
    action = None

    def post(self, request, order_id):
        serializer = EmptyActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = services.transition_sales_order(company=request.company, membership=request.membership, order_id=order_id, action=self.action)
        return Response(selectors.order_detail(order=selectors.order_by_id(company=request.company, order_id=order.pk), membership=request.membership))
