from django.core.management.base import BaseCommand
from apps.documents.models import Document
from apps.documents.services import cleanup_document_file


class Command(BaseCommand):
    help = "Retry physical deletion for documents already soft-deleted."

    def handle(self, **options):
        ids = Document.objects.filter(deleted_at__isnull=False, file_deleted_at__isnull=True).values_list("pk", flat=True)
        for pk in ids.iterator(chunk_size=200):
            cleanup_document_file(pk)
        self.stdout.write("Document cleanup completed; failed deletions remain tracked for retry.")
