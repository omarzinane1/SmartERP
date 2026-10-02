from decimal import Decimal, ROUND_HALF_UP

CENT = Decimal("0.01")
HUNDRED = Decimal("100")
ZERO = Decimal("0.00")


def line_amounts(line):
    """Same order and half-up cent rounding as frontend src/lib/money.ts."""
    gross = (line["quantity"] * line["unit_price"]).quantize(CENT, rounding=ROUND_HALF_UP)
    discount = (gross * line["discount_rate"] / HUNDRED).quantize(CENT, rounding=ROUND_HALF_UP)
    net = gross - discount
    tax = (net * line["tax_rate"] / HUNDRED).quantize(CENT, rounding=ROUND_HALF_UP)
    return dict(gross_total=gross, discount_total=discount, subtotal=net, tax_total=tax, line_total=net + tax)


def document_totals(lines):
    totals = {key: sum((line[key] for line in lines), ZERO) for key in ("gross_total", "discount_total", "subtotal", "tax_total", "line_total")}
    totals["total"] = totals.pop("line_total")
    return totals
