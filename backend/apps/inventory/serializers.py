from decimal import Decimal
from rest_framework import serializers
from apps.companies.serializers import StrictSerializer


class ReferenceInput(StrictSerializer):
    name = serializers.CharField(max_length=80)
    code = serializers.CharField(max_length=80, required=False)


class UnitInput(ReferenceInput):
    name = serializers.CharField(max_length=30)
    code = serializers.CharField(max_length=30, required=False)


class ProductInput(StrictSerializer):
    name = serializers.CharField(min_length=2, max_length=150)
    sku = serializers.CharField(max_length=60, source="reference")
    type = serializers.ChoiceField(choices=["product", "service"], source="kind")
    category = serializers.CharField(max_length=80)
    supplier_id = serializers.IntegerField(min_value=1)
    purchase_price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0, max_value=1000000)
    selling_price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0, max_value=1000000, source="unit_price")
    unit = serializers.CharField(max_length=30)
    barcode = serializers.CharField(max_length=80, allow_blank=True)
    minimum_stock = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=0, max_value=1000000)
    maximum_stock = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=0, max_value=1000000)
    description = serializers.CharField(max_length=5000, allow_blank=True)
    status = serializers.ChoiceField(choices=["active", "archived"], required=False)
    tax_rate = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=0, max_value=100, required=False)


class WarehouseInput(StrictSerializer):
    name = serializers.CharField(min_length=2, max_length=150)
    code = serializers.CharField(max_length=50, required=False)
    city = serializers.CharField(max_length=80)
    country = serializers.CharField(max_length=80)
    manager = serializers.CharField(max_length=150)
    capacity = serializers.IntegerField(min_value=1, max_value=10000000)
    capacity_unit = serializers.ChoiceField(choices=["unités"], default="unités")
    status = serializers.ChoiceField(choices=["active", "inactive"], required=False)


class MovementInput(StrictSerializer):
    product_id = serializers.IntegerField(min_value=1)
    warehouse_id = serializers.IntegerField(min_value=1)
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0.001"), max_value=1000000)
    type = serializers.ChoiceField(choices=["in", "out", "adjustment", "return"])
    adjustment_direction = serializers.ChoiceField(choices=["increase", "decrease"], required=False)
    date = serializers.DateField()
    source_reference = serializers.CharField(max_length=150, allow_blank=True, default="")
    note = serializers.CharField(max_length=5000, allow_blank=True, default="")
    unit_cost = serializers.DecimalField(max_digits=18, decimal_places=6, min_value=0, max_value=1000000, required=False)

    def validate(self, data):
        if data["type"] == "adjustment" and "adjustment_direction" not in data:
            raise serializers.ValidationError("Sens d'ajustement obligatoire.")
        return data


class TransferLineInput(StrictSerializer):
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0.001"), max_value=1000000)


class TransferInput(StrictSerializer):
    source_warehouse_id = serializers.IntegerField(min_value=1)
    destination_warehouse_id = serializers.IntegerField(min_value=1)
    date = serializers.DateField()
    reference_external = serializers.CharField(max_length=150, allow_blank=True)
    notes = serializers.CharField(max_length=5000, allow_blank=True)
    lines = TransferLineInput(many=True, min_length=1, max_length=100)

    def validate_lines(self, value):
        serializer = TransferLineInput(data=value, many=True)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data


class InventoryFilter(serializers.Serializer):
    search = serializers.CharField(max_length=150, required=False, allow_blank=True)
    status = serializers.CharField(max_length=30, required=False, allow_blank=True)
    category = serializers.CharField(max_length=80, required=False, allow_blank=True)
    stock_status = serializers.CharField(max_length=30, required=False, allow_blank=True)
    product = serializers.IntegerField(min_value=1, required=False)
    warehouse = serializers.IntegerField(min_value=1, required=False)
    type = serializers.ChoiceField(choices=["in", "out", "adjustment", "return", "transfer"], required=False)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    ordering = serializers.ChoiceField(choices=["name", "-name", "sku", "-sku", "date", "-date", "reference", "-reference"], required=False)
