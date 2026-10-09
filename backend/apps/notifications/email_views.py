from rest_framework import serializers
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.companies.serializers import StrictSerializer
from common.permissions import HasActiveCompany
from common.views import CompanyAPIView
from .models import BusinessEmail
from .email_services import email_payload


class EmailHistoryInput(StrictSerializer):
    entity_type = serializers.ChoiceField(choices=["invoice", "quote", "purchaseorder", "payment", "approval"])
    entity_id = serializers.IntegerField(min_value=1)


class EmailHistoryView(CompanyAPIView):
    permission_classes = [IsAuthenticated, HasActiveCompany]

    def get(self, request):
        params = EmailHistoryInput(data=request.query_params)
        params.is_valid(raise_exception=True)
        kind, pk = params.validated_data["entity_type"], params.validated_data["entity_id"]
        permission = {"invoice": "invoices.view", "quote": "quotes.view", "purchaseorder": "purchases.view", "payment": "payments.view", "approval": "approvals.view"}[kind]
        if permission not in self.codes():
            raise PermissionDenied()
        if kind == "invoice":
            from apps.sales.invoice_selectors import invoice_queryset
            query = invoice_queryset(request.company)
        elif kind == "quote":
            from apps.sales.selectors import quote_queryset
            query = quote_queryset(request.company)
        elif kind == "purchaseorder":
            from apps.purchasing.selectors import purchase_queryset
            query = purchase_queryset(request.company)
        elif kind == "payment":
            from apps.finance.models import Payment
            query = Payment.objects.filter(company=request.company, customer__company=request.company, direction="incoming")
        else:
            from .selectors import entity_queryset
            query = entity_queryset("approval", request.company.pk, request.user.pk)
        if not query.filter(pk=pk).exists():
            raise NotFound()
        emails = BusinessEmail.objects.filter(company=request.company, entity_type=kind, entity_id=pk)
        if kind == "approval":
            # Only the recipient sees their approval notification delivery metadata.
            emails = emails.filter(recipient_user=request.user)
        from common.email_delivery import expire_email_claims
        expire_email_claims(emails)
        return Response(dict(emails=[email_payload(obj) for obj in emails[:50]], **self.metadata()))
