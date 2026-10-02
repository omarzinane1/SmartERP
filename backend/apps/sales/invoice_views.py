from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.accounts.selectors import get_effective_permission_codes
from apps.crm.selectors import salesperson_name
from common.pagination import CollectionPagination
from common.permissions import HasActiveCompany, HasPermission
from . import invoice_selectors as selectors, invoice_services as services
from .invoice_serializers import InvoiceFilterSerializer, InvoiceInputSerializer, OrderInvoiceInputSerializer
from .order_selectors import order_by_id, order_detail


class InvoiceListView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]

    @property
    def required_permission(self):
        return "invoices.create" if self.request.method == "POST" else "invoices.view"

    def get(self, request):
        filters = InvoiceFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)
        query = selectors.filter_invoices(selectors.invoice_queryset(request.company), filters.validated_data, company=request.company)
        pager = CollectionPagination()
        rows = pager.paginate_queryset(query, request)
        permissions = get_effective_permission_codes(membership=request.membership)
        return Response(pager.envelope(key="invoices", rows=[selectors.invoice_payload(i, permissions=permissions) for i in rows], permissions=permissions,
                                      asOf=timezone.localdate().isoformat(), currentSalesperson=salesperson_name(request.membership)))

    def post(self, request):
        serializer = InvoiceInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invoice = services.save_invoice(company=request.company, membership=request.membership, data=serializer.validated_data)
        return Response(selectors.invoice_detail(invoice=selectors.invoice_by_id(company=request.company, invoice_id=invoice.pk), membership=request.membership), status=201)


class InvoiceDetailView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]

    @property
    def required_permission(self):
        return "invoices.edit" if self.request.method == "PATCH" else "invoices.view"

    def get(self, request, invoice_id):
        return Response(selectors.invoice_detail(invoice=selectors.invoice_by_id(company=request.company, invoice_id=invoice_id), membership=request.membership))

    def patch(self, request, invoice_id):
        selectors.invoice_by_id(company=request.company, invoice_id=invoice_id)
        serializer = InvoiceInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        invoice = services.save_invoice(company=request.company, membership=request.membership, data=serializer.validated_data, invoice_id=invoice_id)
        return Response(selectors.invoice_detail(invoice=selectors.invoice_by_id(company=request.company, invoice_id=invoice.pk), membership=request.membership))


class OrderInvoiceView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]
    required_permission = "invoices.create"

    def post(self, request, order_id):
        serializer = OrderInvoiceInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invoice = services.create_invoice_from_order(company=request.company, membership=request.membership, order_id=order_id, amount=serializer.validated_data["amount"])
        return Response(dict(order=order_detail(order=order_by_id(company=request.company, order_id=order_id), membership=request.membership), reference=invoice.number), status=201)


class InvoiceAgingView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]
    required_permission = "invoices.view"

    def get(self, request):
        return Response(selectors.invoice_aging(company=request.company))
