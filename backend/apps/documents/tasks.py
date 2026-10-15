from celery import shared_task
from .rag.indexer import ingest


@shared_task(name="documents.index_document", soft_time_limit=600, time_limit=620, ignore_result=True)
def index_document(document_id):
    ingest(document_id)
