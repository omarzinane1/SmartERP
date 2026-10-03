from django.db.models import Q
from django.utils import timezone
from rest_framework.response import Response
from apps.sales.serializers import EmptyActionSerializer
from apps.sales.invoice_serializers import InvoiceFilterSerializer
from apps.finance.serializers import InvoicePaymentInputSerializer
from apps.finance.services import create_payment
from common.pagination import CollectionPagination
from .views import PurchasingView
from .models import Supplier
from .invoice_serializers import SupplierInvoiceInput
from . import invoice_services as services, invoice_selectors as selectors


class SupplierInvoiceListView(PurchasingView):
    @property
    def required_permission(self):
        return "supplier_invoices.create" if self.request.method == "POST" else "supplier_invoices.view"

    def get(self, request):
        filters = InvoiceFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)
        query = selectors.invoice_queryset(request.company)
        values = filters.validated_data
        if values.get("search"):
            term = values["search"]
            query = query.filter(Q(number__icontains=term) | Q(supplier_reference__icontains=term) | Q(supplier__name__icontains=term))
        for key, lookup in [("workflow", "status"), ("date_from", "issue_date__gte"), ("date_to", "issue_date__lte")]:
            if key in values:
                query = query.filter(**{lookup: values[key]})
        pager, codes = CollectionPagination(), self.codes()
        page = pager.paginate_queryset(query, request)
        return Response(pager.envelope(key="invoices", rows=[selectors.invoice_payload(i, codes) for i in page], permissions=codes,
            asOf=timezone.localdate().isoformat(), suppliers=list(Supplier.objects.filter(company=request.company, status="active").values("id", "name")), canExport=False))

    def post(self, request):
        serializer = SupplierInvoiceInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        invoice = services.save_supplier_invoice(company=request.company, membership=request.membership, data=serializer.validated_data, key=request.headers.get("Idempotency-Key"))
        return Response(selectors.invoice_payload(selectors.invoice_by_id(request.company, invoice.pk), self.codes(), True), status=201)


class SupplierInvoiceDetailView(PurchasingView):
    @property
    def required_permission(self):
        return "supplier_invoices.edit" if self.request.method == "PATCH" else "supplier_invoices.view"

    def get(self, request, invoice_id):
        return Response(selectors.invoice_payload(selectors.invoice_by_id(request.company, invoice_id), self.codes(), True))

    def patch(self, request, invoice_id):
        selectors.invoice_by_id(request.company, invoice_id)
        serializer = SupplierInvoiceInput(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        services.save_supplier_invoice(company=request.company, membership=request.membership, invoice_id=invoice_id, data=serializer.validated_data)
        return self.get(request, invoice_id)


class SupplierInvoiceActionView(PurchasingView):
    action = None

    @property
    def required_permission(self):
        return "payments.create" if self.action == "payment" else "supplier_invoices.edit"

    def post(self, request, invoice_id):
        invoice = selectors.invoice_by_id(request.company, invoice_id)
        serializer = (InvoicePaymentInputSerializer if self.action == "payment" else EmptyActionSerializer)(data=request.data)
        serializer.is_valid(raise_exception=True)
        if self.action == "payment":
            values = dict(serializer.validated_data)
            values["reference_external"] = values.pop("reference")
            create_payment(company=request.company, membership=request.membership, key=request.headers.get("Idempotency-Key"),
                data=dict(direction="outgoing", partner_id=invoice.supplier_id, invoice_id=invoice.pk, currency=invoice.currency, **values))
        else:
            services.post_supplier_invoice(company=request.company, membership=request.membership, invoice_id=invoice_id)
        return Response(selectors.invoice_payload(selectors.invoice_by_id(request.company, invoice_id), self.codes(), True))


class SupplierInvoiceAgingView(PurchasingView):
    required_permission = "supplier_invoices.view"

    def get(self, request):
        return Response(selectors.payable_aging(request.company))


class PurchaseBillView(PurchasingView):
    required_permission = "supplier_invoices.create"

    def post(self, request, order_id):
        serializer = EmptyActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invoice = services.bill_purchase_order(company=request.company, membership=request.membership, order_id=order_id, key=request.headers.get("Idempotency-Key"))
        return Response(selectors.invoice_payload(selectors.invoice_by_id(request.company, invoice.pk), self.codes(), True), status=201)
