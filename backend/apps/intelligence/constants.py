from datetime import timedelta

RULE_PERMISSIONS = {
    "overdue_invoice": {"invoices.view"},
    "low_stock": {"inventory.view", "products.view"},
    "negative_cash_flow": {"finance.view", "cashflow.view"},
    "expense_spike": {"expenses.view"},
}
FORECAST_PERMISSIONS = {
    "revenue": {"invoices.view", "forecast.view"},
    "net_cash_flow": {"finance.view", "cashflow.view", "forecast.view"},
}
ANALYTICS_VERSION = "decimal-daily-v1"
STATUSES = ["open", "acknowledged", "resolved", "dismissed"]
SEVERITIES = ["low", "medium", "high", "critical"]
ACTIVE = ["open", "acknowledged"]
RISK_TTL = timedelta(hours=24)
RUN_LEASE = timedelta(minutes=20)
MAX_SIGNALS = 10000


def allowed_rules(codes):
    if "ai.use" not in codes:
        return []
    from .opportunity_config import allowed_types
    return [rule for rule, needed in RULE_PERMISSIONS.items() if needed.issubset(codes)] + [
        f"forecast:{metric}" for metric, needed in FORECAST_PERMISSIONS.items() if (needed | {"forecast.recalculate"}).issubset(codes)] + [
        f"opportunity:{kind}" for kind in allowed_types(codes)]
