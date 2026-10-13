"""Versioned, centralized policy; priorities are labels, never AI scores."""
from datetime import timedelta

VERSION = "opportunities-v1"
MAX_CANDIDATES = 5000
HISTORY_DAYS = 365
CUSTOMER_INACTIVITY_DAYS = 90
MIN_CUSTOMER_ORDERS = 3
VALUE_MIN_CUSTOMERS = 10
VALUE_RECENCY_DAYS = 30
RECEIVABLE_MIN_AGE = 30
RECEIVABLE_SHARE = "0.20"
RECEIVABLE_HIGH_AGE = 60
RECEIVABLE_HIGH_SHARE = "0.50"
DEMAND_DAYS = 30
MIN_DEMAND_DAYS = 3
DORMANT_STOCK_DAYS = 90
TTL = timedelta(days=7)
STATUSES = ["open", "acknowledged", "completed", "dismissed", "expired"]
ACTIVE = ["open", "acknowledged"]
PRIORITIES = ["low", "medium", "high", "critical"]
PERMISSIONS = {
    "customer_reactivation": {"customers.view", "sales.view"},
    "high_value_customer": {"customers.view", "invoices.view"},
    "receivable_collection": {"customers.view", "invoices.view"},
    "stock_replenishment": {"products.view", "inventory.view"},
    "dormant_stock": {"products.view", "inventory.view"},
}
DOMAINS = {"customer_reactivation": "sales", "high_value_customer": "sales", "receivable_collection": "finance",
           "stock_replenishment": "inventory", "dormant_stock": "inventory"}


def allowed_types(codes):
    if not {"ai.use", "ai.opportunities.view"}.issubset(codes):
        return []
    return [kind for kind, needed in PERMISSIONS.items() if needed.issubset(codes)]
