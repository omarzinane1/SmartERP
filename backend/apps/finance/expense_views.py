from django.db.models import Q
from django.utils import timezone
from rest_framework.response import Response
from apps.inventory.views import InventoryView
from apps.sales.serializers import EmptyActionSerializer
from common.pagination import CollectionPagination
from . import expense_selectors as read, expense_services as services
from .expense_serializers import ExpenseInput, ExpenseFilter, RejectExpenseInput


class ExpenseListView(InventoryView):
    @property
    def required_permission(self):
        return "expenses.create" if self.request.method == "POST" else "expenses.view"

    def get(self, request):
        filters = ExpenseFilter(data=request.query_params)
        filters.is_valid(raise_exception=True)
        query = read.expense_queryset(request.company)
        values = filters.validated_data
        for key, lookup in [("status", "status"), ("category", "category"), ("supplier_id", "supplier_id"), ("date_from", "date__gte"), ("date_to", "date__lte")]:
            if key in values:
                query = query.filter(**{lookup: values[key]})
        if values.get("search"):
            term = values["search"]
            query = query.filter(Q(number__icontains=term) | Q(description__icontains=term) | Q(employee__icontains=term) | Q(supplier__name__icontains=term))
        pager = CollectionPagination()
        rows = pager.paginate_queryset(query, request)
        categories = sorted(set(read.CATEGORIES) | set(read.expense_queryset(request.company).values_list("category", flat=True)))
        return Response(pager.envelope(key="expenses", rows=[read.expense_payload(e, self.codes()) for e in rows],
            permissions=self.codes(), asOf=timezone.localdate().isoformat(), suppliers=self.suppliers(), categories=categories))

    def post(self, request):
        obj = services.create_expense(company=request.company, membership=request.membership, data=self.validated(ExpenseInput), key=request.headers.get("Idempotency-Key"))
        return Response(read.expense_payload(obj, self.codes()), status=201)


class ExpenseDetailView(InventoryView):
    @property
    def required_permission(self):
        return "expenses.create" if self.request.method == "PATCH" else "expenses.view"

    def get(self, request, expense_id):
        return Response(read.expense_payload(read.expense_by_id(request.company, expense_id), self.codes()))

    def patch(self, request, expense_id):
        read.expense_by_id(request.company, expense_id)
        obj = services.create_expense(company=request.company, membership=request.membership, expense_id=expense_id, data=self.validated(ExpenseInput, partial=True))
        return Response(read.expense_payload(obj, self.codes()))


class ExpenseActionView(InventoryView):
    action = None

    @property
    def required_permission(self):
        return "expenses.create" if self.action == "submit" else "expenses.approve"

    def post(self, request, expense_id):
        data = self.validated(RejectExpenseInput if self.action == "reject" else EmptyActionSerializer)
        obj = services.transition_expense(company=request.company, membership=request.membership, expense_id=expense_id, action=self.action, **data)
        return Response(read.expense_payload(obj, self.codes()))
