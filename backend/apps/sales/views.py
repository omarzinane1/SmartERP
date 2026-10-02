from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.accounts.selectors import get_effective_permission_codes
from apps.crm.selectors import salesperson_name
from common.pagination import CollectionPagination
from common.permissions import HasActiveCompany, HasPermission
from . import selectors, services
from .serializers import EmptyActionSerializer, QuoteFilterSerializer, QuoteInputSerializer


class QuoteListView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]

    @property
    def required_permission(self):
        return "quotes.create" if self.request.method == "POST" else "quotes.view"

    def get(self, request):
        filters = QuoteFilterSerializer(data=request.query_params)
        filters.is_valid(raise_exception=True)
        query = selectors.filter_quotes(selectors.quote_queryset(request.company), filters.validated_data, company=request.company)
        pager = CollectionPagination()
        rows = pager.paginate_queryset(query, request)
        return Response(pager.envelope(key="results", rows=[selectors.quote_payload(q) for q in rows],
                                      permissions=get_effective_permission_codes(membership=request.membership),
                                      current_salesperson=salesperson_name(request.membership), as_of=timezone.localdate().isoformat(), products=selectors.product_catalog(request.company)))

    def post(self, request):
        serializer = QuoteInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        quote = services.save_quote(company=request.company, membership=request.membership, data=serializer.validated_data)
        return Response(selectors.quote_detail(quote=selectors.quote_by_id(company=request.company, quote_id=quote.pk), membership=request.membership), status=201)


class QuoteDetailView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]

    @property
    def required_permission(self):
        return "quotes.edit" if self.request.method == "PATCH" else "quotes.view"

    def get(self, request, quote_id):
        return Response(selectors.quote_detail(quote=selectors.quote_by_id(company=request.company, quote_id=quote_id), membership=request.membership))

    def patch(self, request, quote_id):
        selectors.quote_by_id(company=request.company, quote_id=quote_id)
        serializer = QuoteInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        quote = services.save_quote(company=request.company, membership=request.membership, quote_id=quote_id, data=serializer.validated_data)
        return Response(selectors.quote_detail(quote=selectors.quote_by_id(company=request.company, quote_id=quote.pk), membership=request.membership))


class QuoteActionView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]
    action = None

    @property
    def required_permission(self):
        return {"send": "quotes.send", "accept": "quotes.accept", "reject": "quotes.accept", "viewed": "quotes.edit", "expire": "quotes.edit", "duplicate": "quotes.create"}[self.action]

    def post(self, request, quote_id):
        serializer = EmptyActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        kwargs = dict(company=request.company, membership=request.membership, quote_id=quote_id)
        if self.action == "duplicate":
            quote = services.duplicate_quote(**kwargs)
        else:
            quote = services.transition_quote(**kwargs, action=self.action)
        quote = selectors.quote_by_id(company=request.company, quote_id=quote.pk)
        return Response(selectors.quote_detail(quote=quote, membership=request.membership), status=201 if self.action == "duplicate" else 200)
