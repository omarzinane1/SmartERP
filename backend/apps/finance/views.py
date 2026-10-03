from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.accounts.selectors import get_effective_permission_codes
from apps.sales.serializers import EmptyActionSerializer
from common.pagination import CollectionPagination
from common.permissions import HasActiveCompany, HasPermission
from . import selectors, services
from .serializers import PaymentFilterSerializer, PaymentInputSerializer, AllocationInputSerializer


class PaymentListView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]

    @property
    def required_permission(self):
        return "payments.create" if self.request.method == "POST" else "payments.view"

    def get(self, request):
        filters = PaymentFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)
        base = selectors.payment_queryset(request.company)
        query = selectors.filter_payments(base, filters.validated_data)
        pager = CollectionPagination()
        rows = pager.paginate_queryset(query, request)
        permissions = get_effective_permission_codes(membership=request.membership)
        return Response(pager.envelope(key="payments", rows=[selectors.payment_payload(p, permissions) for p in rows],
            totalCount=base.count(), permissions=permissions, asOf=timezone.localdate().isoformat(), **selectors.payment_options(request.company, permissions)))

    def post(self, request):
        serializer = PaymentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = services.create_payment(company=request.company, membership=request.membership,
            data=serializer.validated_data, key=request.headers.get("Idempotency-Key"))
        return Response(selectors.payment_payload(selectors.payment_by_id(request.company, payment.pk),
            get_effective_permission_codes(membership=request.membership)), status=201)


class PaymentSummaryView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]
    required_permission = "payments.view"

    def get(self, request):
        serializer = PaymentFilterSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        return Response(selectors.payment_summary(selectors.filter_payments(selectors.payment_queryset(request.company), serializer.validated_data)))


class PaymentDetailView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]
    required_permission = "payments.view"

    def get(self, request, payment_id):
        return Response(selectors.payment_payload(selectors.payment_by_id(request.company, payment_id), get_effective_permission_codes(membership=request.membership)))


class PaymentActionView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]
    action = None

    @property
    def required_permission(self):
        return "payments.cancel" if self.action == "cancel" else "payments.create"

    def post(self, request, payment_id):
        selectors.payment_by_id(request.company, payment_id)
        serializer = (EmptyActionSerializer if self.action == "cancel" else AllocationInputSerializer)(data=request.data)
        serializer.is_valid(raise_exception=True)
        args = dict(company=request.company, membership=request.membership, payment_id=payment_id)
        if self.action == "cancel":
            services.cancel_payment(**args)
        else:
            services.allocate_payment(**args, **serializer.validated_data, key=request.headers.get("Idempotency-Key"))
        return Response(selectors.payment_payload(selectors.payment_by_id(request.company, payment_id), get_effective_permission_codes(membership=request.membership)))
