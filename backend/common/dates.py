from zoneinfo import ZoneInfo
from django.utils import timezone


def company_today(company):
    return timezone.localdate(timezone=ZoneInfo(company.timezone))
