from django.db import migrations


def backfill(apps, schema_editor):
    Expense = apps.get_model("finance", "Expense")
    Category = apps.get_model("finance", "ExpenseCategory")
    db = schema_editor.connection.alias
    pairs = Expense.objects.using(db).order_by().values_list("company_id", "category").distinct()
    for company_id, name in pairs.iterator():
        category, _ = Category.objects.using(db).get_or_create(company_id=company_id, name=name, defaults={"code": name})
        Expense.objects.using(db).filter(company_id=company_id, category=name, category_record__isnull=True).update(category_record=category)


class Migration(migrations.Migration):
    dependencies = [("finance", "0005_alter_expense_rejection_reason_and_more")]
    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
