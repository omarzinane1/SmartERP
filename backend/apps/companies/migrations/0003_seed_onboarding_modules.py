from django.db import migrations


MODULES = (
    ("sales", "Ventes"), ("customers", "Clients"),
    ("suppliers", "Fournisseurs"), ("purchases", "Achats"),
    ("products", "Produits"), ("inventory", "Stock"),
    ("warehouses", "Dépôts"), ("invoices", "Factures"),
    ("payments", "Paiements"), ("expenses", "Dépenses"),
    ("treasury", "Trésorerie"), ("reports", "Rapports"),
    ("documents", "Documents"), ("ai_assistant", "AI Assistant"),
    ("ai_control_center", "AI Control Center"), ("forecasting", "Forecasting"),
)


def seed_modules(apps, schema_editor):
    ModuleDefinition = apps.get_model("companies", "ModuleDefinition")
    for code, label in MODULES:
        ModuleDefinition.objects.using(schema_editor.connection.alias).update_or_create(
            code=code, defaults={"label": label, "is_active": True},
        )


class Migration(migrations.Migration):
    dependencies = [("companies", "0002_onboarding_settings")]
    operations = [migrations.RunPython(seed_modules, reverse_code=migrations.RunPython.noop)]
