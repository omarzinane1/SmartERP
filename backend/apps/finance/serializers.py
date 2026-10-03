from decimal import Decimal
from rest_framework import serializers
from apps.companies.serializers import StrictSerializer

METHODS = ["bank_transfer", "cash", "card", "cheque", "other"]


class PaymentInputSerializer(StrictSerializer):
    direction = serializers.ChoiceField(choices=["incoming", "outgoing"])
    partner_id = serializers.IntegerField(min_value=1)
    invoice_id = serializers.IntegerField(min_value=1, required=False, allow_null=True, default=None)
    date = serializers.DateField()
    amount = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=Decimal("0.01"), max_value=Decimal("100000000"))
    currency = serializers.CharField(min_length=3, max_length=3, required=False, default="MAD")
    method = serializers.ChoiceField(choices=METHODS)
    reference_external = serializers.CharField(max_length=150, allow_blank=True, default="")
    note = serializers.CharField(max_length=5000, allow_blank=True, default="")


class AllocationInputSerializer(StrictSerializer):
    invoice_id = serializers.IntegerField(min_value=1)
    amount = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=Decimal("0.01"))


class InvoicePaymentInputSerializer(StrictSerializer):
    date = serializers.DateField()
    amount = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=Decimal("0.01"), max_value=Decimal("100000000"))
    method = serializers.ChoiceField(choices=[*METHODS, "Virement bancaire", "Espèces", "Carte", "Chèque", "Autre"])
    reference = serializers.CharField(max_length=150, allow_blank=True)
    note = serializers.CharField(max_length=5000, allow_blank=True)

    def validate_method(self, value):
        return dict(zip(["Virement bancaire", "Espèces", "Carte", "Chèque", "Autre"], METHODS)).get(value, value)


class PaymentFilterSerializer(serializers.Serializer):
    search = serializers.CharField(max_length=150, required=False, allow_blank=True)
    direction = serializers.ChoiceField(choices=["", "incoming", "outgoing"], required=False)
    status = serializers.ChoiceField(choices=["", "pending", "completed", "cancelled", "failed"], required=False)
    method = serializers.ChoiceField(choices=["", *METHODS], required=False)
    partner_type = serializers.ChoiceField(choices=["", "customer", "supplier"], required=False)
    partner_id = serializers.IntegerField(min_value=1, required=False)
    invoice = serializers.CharField(max_length=100, required=False, allow_blank=True)
    period = serializers.ChoiceField(choices=["", "today", "week", "month", "custom"], required=False)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    min_amount = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=0, required=False)
    max_amount = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=0, required=False)
    sort = serializers.ChoiceField(choices=["date_desc", "date_asc", "amount_desc", "reference"], default="date_desc")
