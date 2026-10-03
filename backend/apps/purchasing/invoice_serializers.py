from rest_framework import serializers
from apps.companies.serializers import StrictSerializer
from .serializers import PurchaseLineInputSerializer


class SupplierInvoiceLineInput(PurchaseLineInputSerializer):
    purchase_line_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)


class SupplierInvoiceInput(StrictSerializer):
    supplier_id = serializers.IntegerField(min_value=1)
    supplier_reference = serializers.CharField(max_length=120)
    order_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    invoice_date = serializers.DateField(source="issue_date")
    due_date = serializers.DateField()
    currency = serializers.ChoiceField(choices=["MAD"])
    payment_terms = serializers.CharField(max_length=500, allow_blank=True)
    notes = serializers.CharField(max_length=5000, allow_blank=True)
    lines = SupplierInvoiceLineInput(many=True, min_length=1, max_length=100)

    def validate_lines(self, value):
        serializer = SupplierInvoiceLineInput(data=value, many=True)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data
