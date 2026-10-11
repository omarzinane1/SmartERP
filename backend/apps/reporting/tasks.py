from celery import shared_task
from .job_services import execute_job, expire_jobs


@shared_task(bind=True, max_retries=3, soft_time_limit=840, time_limit=900)
def generate_report_export(self, job_id):
    return execute_job(self, job_id, "report_export")


@shared_task(bind=True, max_retries=3, soft_time_limit=840, time_limit=900)
def generate_large_excel_export(self, job_id):
    return execute_job(self, job_id, "excel_export")


@shared_task(bind=True, max_retries=3, soft_time_limit=840, time_limit=900)
def generate_large_pdf(self, job_id):
    return execute_job(self, job_id, "pdf_generation")


@shared_task
def expire_stalled_jobs():
    from common.email_delivery import expire_email_claims
    from apps.intelligence.services import expire_runs
    return dict(jobs=expire_jobs(), emails=expire_email_claims(), intelligence=expire_runs())
