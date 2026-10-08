import logging
from apps.companies.models import Company

logger = logging.getLogger(__name__)


def scan_active_companies(name, scan):
    result = dict(companies=0, created=0, failed=0)
    logger.info("scan_started task=%s", name)
    for company in Company.objects.filter(is_active=True).iterator(chunk_size=100):
        result["companies"] += 1
        try:
            result["created"] += scan(company)
        except Exception as error:
            # Isolate tenant failures. An operator can rerun; dedupe preserves prior rows.
            result["failed"] += 1
            logger.error("scan_company_failed task=%s company_id=%s error_type=%s", name, company.pk, type(error).__name__)
    logger.info("scan_completed task=%s companies=%s created=%s failed=%s", name, result["companies"], result["created"], result["failed"])
    return result
