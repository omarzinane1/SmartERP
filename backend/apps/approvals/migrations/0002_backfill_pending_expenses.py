from django.db import migrations


def backfill(apps, schema_editor):
    Expense = apps.get_model("finance", "Expense")
    Request = apps.get_model("approvals", "ApprovalRequest")
    db = schema_editor.connection.alias
    for expense in Expense.objects.using(db).filter(status="submitted").iterator():
        Request.objects.using(db).get_or_create(company_id=expense.company_id, expense_id=expense.pk, status="pending", defaults=dict(
            workflow_type="expense", number=f"APR-LEGACY-{expense.pk}", requested_by_id=expense.submitted_by_id or expense.created_by_id,
            requested_at=expense.submitted_at or expense.updated_at, source_updated_at=expense.updated_at))


class Migration(migrations.Migration):
    dependencies = [("approvals", "0001_initial"), ("finance", "0006_backfill_expense_categories")]
    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
