from datetime import timedelta

RULE_PERMISSIONS = {
    "overdue_invoice": {"invoices.view"},
    "low_stock": {"inventory.view", "products.view"},
    "negative_cash_flow": {"finance.view", "cashflow.view"},
}
STATUSES = ["open", "acknowledged", "resolved", "dismissed"]
SEVERITIES = ["low", "medium", "high", "critical"]
ACTIVE = ["open", "acknowledged"]
RISK_TTL = timedelta(hours=24)
RUN_LEASE = timedelta(minutes=20)
MAX_SIGNALS = 10000


def allowed_rules(codes):
    return [rule for rule, needed in RULE_PERMISSIONS.items() if needed.issubset(codes)] if "ai.use" in codes else []
