from pathlib import PurePosixPath
from uuid import uuid4


def document_path(instance, filename):
    extension = PurePosixPath(filename).suffix.lower()
    return f"companies/{instance.company_id}/documents/{uuid4().hex}{extension}"


def export_path(instance, filename):
    extension = PurePosixPath(filename).suffix.lower()
    return f"companies/{instance.company_id}/exports/{uuid4().hex}{extension}"
