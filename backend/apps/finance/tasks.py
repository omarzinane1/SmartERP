from celery import shared_task
from common.scans import scan_active_companies
from .scan_services import notify_overdue_company


@shared_task
def scan_overdue_invoices():
    return scan_active_companies("scan_overdue_invoices", notify_overdue_company)
