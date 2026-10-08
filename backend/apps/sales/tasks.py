from celery import shared_task
from common.email_delivery import send_delivery


@shared_task(bind=True, max_retries=3)
def send_invoice_reminder_email(self, reminder_id):
    return send_delivery(self, "reminder", reminder_id)
