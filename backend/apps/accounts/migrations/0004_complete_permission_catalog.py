from django.db import migrations


# Snapshot audited from smarterp-ai/src on 2026-10-01.
# Keep this migration self-contained; never import the live application catalog.
PERMISSION_CODES = (
    "ai.opportunities.view",
    "ai.tools.finance",
    "ai.tools.inventory",
    "ai.use",
    "analytics.view",
    "approvals.approve",
    "approvals.view",
    "audit.export",
    "audit.view",
    "cashflow.view",
    "customers.create",
    "customers.edit",
    "customers.export",
    "customers.view",
    "delivery.create",
    "documents.ai_analyze",
    "documents.delete",
    "documents.upload",
    "documents.view",
    "expenses.approve",
    "expenses.create",
    "expenses.export",
    "expenses.view",
    "finance.view",
    "forecast.recalculate",
    "forecast.view",
    "inventory.analytics.view",
    "inventory.export",
    "inventory.movements.create",
    "inventory.movements.view",
    "inventory.transfers.approve",
    "inventory.transfers.create",
    "inventory.transfers.view",
    "inventory.view",
    "invoices.create",
    "invoices.credit_note",
    "invoices.edit",
    "invoices.post",
    "invoices.remind",
    "invoices.send",
    "invoices.view",
    "modules.manage",
    "payments.cancel",
    "payments.create",
    "payments.export",
    "payments.view",
    "products.create",
    "products.edit",
    "products.export",
    "products.view",
    "purchases.confirm",
    "purchases.create",
    "purchases.edit",
    "purchases.view",
    "quotes.accept",
    "quotes.convert",
    "quotes.create",
    "quotes.edit",
    "quotes.export",
    "quotes.send",
    "quotes.view",
    "receipts.create",
    "reports.export",
    "reports.generate",
    "reports.view",
    "roles.assign",
    "roles.manage",
    "sales.edit",
    "sales.margin.view",
    "sales.view",
    "settings.manage",
    "settings.view",
    "supplier_invoices.create",
    "supplier_invoices.edit",
    "supplier_invoices.view",
    "suppliers.create",
    "suppliers.edit",
    "suppliers.export",
    "suppliers.view",
    "users.manage",
    "warehouses.create",
    "warehouses.view",
)

NON_GRANTABLE_PERMISSIONS = {
    "users.manage",
    "roles.manage",
    "roles.assign",
    "audit.export",
}


def complete_permission_catalog(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    permissions = Permission.objects.using(schema_editor.connection.alias)

    for code in PERMISSION_CODES:
        module, action = code.split(".", 1)
        permissions.update_or_create(
            code=code,
            defaults={
                "label": code,
                "module": module,
                "action": action,
                "is_active": True,
                "is_grantable": code not in NON_GRANTABLE_PERMISSIONS,
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0003_seed_permission_catalog"),
    ]

    operations = [
        migrations.RunPython(
            complete_permission_catalog,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
