from decimal import Decimal, ROUND_HALF_UP
from django.db.models import Sum
from common.exceptions import BusinessConflict
from .models import CompanyInventorySetting, StockLevel

ZERO = Decimal("0")
PRECISION = Decimal("0.000001")


def quantize_value(value):
    return value.quantize(PRECISION, rounding=ROUND_HALF_UP)


def assert_supported_valuation(company):
    setting = CompanyInventorySetting.objects.filter(company=company).first()
    method = setting.valuation_method if setting else "weighted_average"
    if method != "weighted_average":
        raise BusinessConflict(f"Valorisation {method} non prise en charge. Seul le coût moyen pondéré est disponible ; aucune opération de stock n'a été appliquée.")


def get_company_stock_value(*, company, **filters):
    assert_supported_valuation(company)
    return StockLevel.objects.filter(company=company, product__company=company, warehouse__company=company, **filters).aggregate(value=Sum("total_value"))["value"] or ZERO


def get_product_stock_value(*, company, product):
    return get_company_stock_value(company=company, product=product)


def get_warehouse_stock_value(*, company, warehouse):
    return get_company_stock_value(company=company, warehouse=warehouse)
