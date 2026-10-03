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


class InvoiceActionView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]
    action = None

    @property
    def required_permission(self):
        return {"post": "invoices.post", "credit-note": "invoices.credit_note", "remind": "invoices.remind", "payment": "payments.create"}[self.action]

    def post(self, request, invoice_id):
        from . import invoice_workflows as workflows
        from .invoice_serializers import CreditNoteInputSerializer
        from .serializers import EmptyActionSerializer
        from apps.finance.serializers import InvoicePaymentInputSerializer
        from apps.finance.services import create_payment
        invoice = selectors.invoice_by_id(company=request.company, invoice_id=invoice_id)
        serializer = {"post": EmptyActionSerializer, "remind": EmptyActionSerializer,
            "credit-note": CreditNoteInputSerializer, "payment": InvoicePaymentInputSerializer}[self.action](data=request.data)
        serializer.is_valid(raise_exception=True)
        args = dict(company=request.company, membership=request.membership, invoice_id=invoice_id)
        key = request.headers.get("Idempotency-Key")
        if self.action == "post":
            workflows.post_invoice(**args)
        elif self.action == "credit-note":
            workflows.create_credit_note(**args, data=serializer.validated_data, key=key)
        elif self.action == "remind":
            workflows.request_reminder(**args, key=key)
        else:
            data = dict(serializer.validated_data)
            data["reference_external"] = data.pop("reference")
            create_payment(company=request.company, membership=request.membership, key=key,
                data=dict(**data, direction="incoming", partner_id=invoice.customer_id, invoice_id=invoice_id, currency=invoice.currency))
        return Response(selectors.invoice_detail(invoice=selectors.invoice_by_id(company=request.company, invoice_id=invoice_id), membership=request.membership))
