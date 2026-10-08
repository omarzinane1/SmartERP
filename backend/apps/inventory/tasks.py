from celery import shared_task
from common.scans import scan_active_companies
from .scan_services import notify_low_stock_company


@shared_task
def scan_low_stock():
    return scan_active_companies("scan_low_stock", notify_low_stock_company)
