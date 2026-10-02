from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from common.pagination import CollectionPagination
from common.permissions import HasActiveCompany, HasPermission
from . import selectors
from .serializers import CustomerFilterSerializer, CustomerInputSerializer
from .services import save_customer


class CustomerListView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]

    @property
    def required_permission(self):
        return "customers.create" if self.request.method == "POST" else "customers.view"

    def get(self, request):
        serializer = CustomerFilterSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        query = selectors.filter_customers(selectors.customers_queryset(request.company), serializer.validated_data, company=request.company)
        pager = CollectionPagination()
        rows = pager.paginate_queryset(query, request)
        return Response(pager.envelope(key="customers", rows=[selectors.customer_payload(c) for c in rows],
                                      **selectors.customers_metadata(company=request.company, membership=request.membership)))

    def post(self, request):
        serializer = CustomerInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer = save_customer(company=request.company, membership=request.membership, data=serializer.validated_data)
        return Response(selectors.customer_payload(selectors.customer_by_id(company=request.company, customer_id=customer.pk)), status=201)


class CustomerDetailView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]

    @property
    def required_permission(self):
        return "customers.edit" if self.request.method == "PATCH" else "customers.view"

    def get(self, request, customer_id):
        customer = selectors.customer_by_id(company=request.company, customer_id=customer_id)
        return Response(selectors.customer_detail(customer=customer, membership=request.membership))

    def patch(self, request, customer_id):
        selectors.customer_by_id(company=request.company, customer_id=customer_id)
        serializer = CustomerInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        customer = save_customer(company=request.company, membership=request.membership, data=serializer.validated_data, customer_id=customer_id)
        return Response(selectors.customer_payload(selectors.customer_by_id(company=request.company, customer_id=customer.pk)))


class CustomerSummaryView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]
    required_permission = "customers.view"
    selector = staticmethod(selectors.customer_summary)

    def get(self, request, customer_id):
        customer = selectors.customer_by_id(company=request.company, customer_id=customer_id)
        return Response(self.selector(customer=customer, membership=request.membership))


class CustomerActivityView(CustomerSummaryView):
    selector = staticmethod(selectors.customer_activity)
