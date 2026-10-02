"""Frozen interpretation of admin.mock.ts, not an inferred ERP role matrix.

The mock's role catalog has 61 codes, whereas the global catalog has 82.
Owner/Admin receive that explicit subset. New global codes are NOT implicitly
granted. Synchronization is additive and preserves existing assignments.
"""

SYSTEM_ROLES = {
    "owner": "Owner", "admin": "Admin", "manager": "Manager",
    "commercial": "Commercial", "comptable": "Comptable",
    "acheteur": "Acheteur", "stock": "Stock",
}

ROLE_CATALOG = frozenset("""
ai.opportunities.view ai.tools.finance ai.tools.inventory ai.use analytics.view
approvals.approve approvals.view audit.export audit.view
documents.ai_analyze documents.delete documents.upload documents.view
expenses.approve expenses.create expenses.export expenses.view finance.view
forecast.recalculate forecast.view inventory.analytics.view inventory.export
inventory.movements.create inventory.movements.view inventory.transfers.approve
inventory.transfers.create inventory.transfers.view inventory.view
invoices.create invoices.edit invoices.post invoices.send invoices.view
modules.manage payments.create payments.view products.create products.edit
products.export products.view purchases.confirm purchases.create purchases.edit
purchases.view receipts.create reports.export reports.generate reports.view
roles.assign roles.manage sales.view settings.manage settings.view
supplier_invoices.create supplier_invoices.edit supplier_invoices.view
suppliers.edit suppliers.view users.manage warehouses.create warehouses.view
""".split())

NON_GRANTABLE = frozenset({"users.manage", "roles.manage", "roles.assign", "audit.export"})


def permission_action(code):
    last = code.rsplit(".", 1)[-1]
    if code.startswith("ai.") or last == "ai_analyze":
        return "ai"
    if last in {"manage", "assign", "recalculate"}:
        return "sensitive"
    if "approve" in code:
        return "approve"
    return last if last in {"view", "create", "edit", "delete", "export"} else "edit"


def system_permission_codes(role_code):
    if role_code in {"owner", "admin"}:
        return ROLE_CATALOG
    grantable = ROLE_CATALOG - NON_GRANTABLE
    if role_code == "manager":
        return grantable
    module = {"commercial": "sales", "comptable": "invoices", "acheteur": "purchases", "stock": "inventory"}[role_code]
    return frozenset(code for code in grantable if permission_action(code) == "view" or code.split(".")[0] == module)
