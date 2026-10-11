from celery import shared_task
from .services import execute_run


@shared_task
def run_company_intelligence(run_id):
    # PostgreSQL provides the tenant, requesting member and authorized rule set.
    # No network/LLM dependency and no automatic retries for deterministic errors.
    return execute_run(run_id)
