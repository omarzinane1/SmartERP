from django.db import migrations


def copy_history(apps, schema_editor):
    Email = apps.get_model("notifications", "BusinessEmail")
    Reminder = apps.get_model("sales", "InvoiceReminder")
    Notification = apps.get_model("notifications", "Notification")
    alias = schema_editor.connection.alias
    for kind, model in [("reminder", Reminder), ("notification", Notification)]:
        for obj in model.objects.using(alias).iterator(chunk_size=500):
            state = obj.status if kind == "reminder" else obj.email_status
            state = {"requested": "pending", "processing": "sending"}.get(state, state)
            if state == "sent" and obj.email_sent_at is None:
                state = "uncertain"  # Never invent evidence of sending.
            values = dict(company_id=obj.company_id, email_type="invoice_reminder" if kind == "reminder" else "notification",
                entity_type="invoice" if kind == "reminder" else obj.entity_type, entity_id=obj.invoice_id if kind == "reminder" else obj.entity_id,
                dedupe_key=f"{kind}:{obj.pk}", status=state, email_attempts=obj.email_attempts, email_claim=obj.email_claim,
                email_started_at=obj.email_started_at, email_sent_at=obj.email_sent_at, email_error_code=obj.email_error_code)
            if kind == "reminder":
                values.update(reminder_id=obj.pk, requested_by_id=obj.created_by_id, recipient=obj.recipient)
            else:
                values.update(notification_id=obj.pk, recipient_user_id=obj.recipient_id)
            email, created = Email.objects.using(alias).get_or_create(company_id=obj.company_id, dedupe_key=values.pop("dedupe_key"), defaults={k: v for k, v in values.items() if k != "company_id"})
            if created:
                Email.objects.using(alias).filter(pk=email.pk).update(created_at=obj.created_at)


class Migration(migrations.Migration):
    dependencies = [("notifications", "0002_businessemail")]
    operations = [migrations.RunPython(copy_history, migrations.RunPython.noop)]
