from django.db.models import Q
from rest_framework.response import Response
from common.views import CompanyAPIView
from common.pagination import CollectionPagination
from . import selectors as read, services
from .serializers import ApprovalDecisionInput, ApprovalRequestInput, ApprovalFilter


class ApprovalListView(CompanyAPIView):
    @property
    def required_permission(self):
        return "purchases.edit" if self.request.method == "POST" else "approvals.view"

    def get(self, request):
        filters = ApprovalFilter(data=request.query_params)
        filters.is_valid(raise_exception=True)
        query, codes = read.approval_queryset(request.company, self.codes()), self.codes()
        values = filters.validated_data
        if values.get("status"):
            query = query.filter(status=values["status"])
        if values.get("type"):
            query = query.filter(workflow_type="expense" if values["type"] == "expense" else "purchase_review")
        if values.get("search"):
            term = values["search"]
            query = query.filter(Q(number__icontains=term) | Q(expense__description__icontains=term) | Q(purchase_order__number__icontains=term) | Q(requested_by__email__icontains=term))
        pager = CollectionPagination()
        rows = pager.paginate_queryset(query, request)
        allowed = [kind for kind, code in [("expense", "expenses.approve"), ("purchase", "purchases.confirm")] if code in codes and "approvals.approve" in codes]
        return Response(pager.envelope(key="requests", rows=[read.approval_payload(obj, codes, request.membership) for obj in rows], **self.metadata(), allowedApprovalTypes=allowed))

    def post(self, request):
        data = self.validated(ApprovalRequestInput)
        obj = services.request_approval(company=request.company, membership=request.membership, order_id=data["record_id"])
        return Response(read.approval_payload(obj, self.codes(), request.membership), status=201)


class ApprovalDetailView(CompanyAPIView):
    required_permission = "approvals.view"

    def get(self, request, request_id):
        return Response(read.approval_payload(read.approval_by_id(request.company, self.codes(), request_id), self.codes(), request.membership, include_documents=True))


class ApprovalActionView(CompanyAPIView):
    action = None

    @property
    def required_permission(self):
        return "approvals.view" if self.action == "cancel" else "approvals.approve"

    def post(self, request, request_id):
        data = self.validated(ApprovalDecisionInput)
        if self.action == "reject" and len(data["comment"].strip()) < 3:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Motif de refus : trois caractères minimum.")
        if self.action == "cancel":
            obj = services.cancel_approval_request(company=request.company, membership=request.membership, request_id=request_id, data=data)
        else:
            obj = services.decide_request(company=request.company, membership=request.membership, request_id=request_id, action=self.action, data=data)
        return Response(read.approval_payload(obj, self.codes(), request.membership))
