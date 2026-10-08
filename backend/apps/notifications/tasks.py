from celery import shared_task
from common.email_delivery import send_delivery


@shared_task(bind=True, max_retries=3)
def send_notification_email(self, notification_id):
    return send_delivery(self, "notification", notification_id)
