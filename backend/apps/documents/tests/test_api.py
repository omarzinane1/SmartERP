from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from django.db.models.deletion import ProtectedError
from django.test import TestCase, override_settings
from pypdf import PdfWriter
from PIL import Image
from apps.accounts.models import RolePermission, User
from apps.documents.models import Document, DocumentLink
from common.tests.finance_documents_support import FinanceDocumentsMixin


class DocumentAPITests(FinanceDocumentsMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.storage = TemporaryDirectory()
        self.addCleanup(self.storage.cleanup)
        override = override_settings(MEDIA_ROOT=self.storage.name)
        override.enable()
        self.addCleanup(override.disable)

    def upload(self, filename="justificatif-école.txt", content="Justificatif vérifié".encode(), mime="text/plain", **values):
        return self.client.post("/api/documents/", dict(file=SimpleUploadedFile(filename, content, content_type=mime), category="Finance", department="Finance", visibility="Public entreprise", **values), format="multipart")

    def read_stream(self, response):
        data = b"".join(response.streaming_content)
        return data

    def test_upload_list_detail_pages_download_and_safe_path(self):
        response = self.upload(filename="../../evil\\école.txt")
        self.assertEqual(response.status_code, 201, response.data)
        obj = Document.objects.get()
        self.assertNotIn("evil", obj.file.name)
        self.assertTrue(obj.file.name.startswith(f"companies/{self.company.pk}/documents/"))
        self.assertEqual(self.client.get("/api/documents/?search=école").data["count"], 1)
        detail = self.client.get(f"/api/documents/{obj.pk}/")
        self.assertEqual(detail.data["status"], "uploaded")
        self.assertFalse(detail.data["capabilities"]["canIndex"])
        self.assertEqual(self.client.get(f"/api/documents/{obj.pk}/pages/").data[0]["text"], "Justificatif vérifié")
        download = self.client.get(f"/api/documents/{obj.pk}/download/")
        self.assertEqual(download.status_code, 200)
        self.assertIn("attachment", download["Content-Disposition"])
        self.assertEqual(download["X-Content-Type-Options"], "nosniff")
        self.assertEqual(self.read_stream(download), "Justificatif vérifié".encode())

    def test_invalid_extension_mime_magic_size_and_status_injection(self):
        for filename, data, mime in [("bad.exe", b"hello", "text/plain"), ("bad.txt", b"hello", "application/pdf"), ("bad.pdf", b"%PDF-garbage", "application/pdf"), ("bad.png", b"not an image", "image/png"), ("bad.txt", b"\x00binary", "text/plain"), ("empty.txt", b"", "text/plain")]:
            self.assertEqual(self.upload(filename, data, mime).status_code, 400)
        self.assertEqual(self.upload(content=b"x" * (15*1024*1024+1)).status_code, 400)
        self.assertEqual(self.upload(status="indexed").status_code, 400)
        self.assertFalse(Document.objects.exists())
        self.assertFalse(list(Path(self.storage.name).rglob("*.*")))

    def test_valid_pdf_and_image(self):
        stream = BytesIO()
        writer = PdfWriter()
        writer.add_blank_page(width=200, height=200)
        writer.write(stream)
        response = self.upload("page.pdf", stream.getvalue(), "application/pdf")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["pageCount"], 1)
        image = BytesIO()
        Image.new("RGB", (10, 10), "white").save(image, "PNG")
        response = self.upload("image.png", image.getvalue(), "image/png")
        self.assertEqual(response.status_code, 201, response.data)
        preview = self.client.get(f"/api/documents/{response.data['id']}/preview/")
        self.assertIn("inline", preview["Content-Disposition"])
        self.read_stream(preview)

    def test_link_invoice_and_supplier_unlink_foreign_and_protect_deletion(self):
        invoice = self.invoice()
        supplier = self.supplier()
        doc = self.upload(entity_type="invoice", entity_id=invoice["id"])
        self.assertEqual(doc.status_code, 201, doc.data)
        obj = Document.objects.get()
        link = self.post(f"/api/documents/{obj.pk}/link/", dict(entity_type="supplier", entity_id=supplier["id"]))
        self.assertEqual(link.status_code, 201, link.data)
        self.assertEqual(self.post(f"/api/documents/{obj.pk}/link/", dict(entity_type="customer", entity_id=self.foreign_customer.pk)).status_code, 404)
        self.assertEqual(self.post(f"/api/documents/{obj.pk}/link/", dict(entity_type="secret_table", entity_id=1)).status_code, 400)
        from apps.purchasing.models import Supplier
        with self.assertRaises(ProtectedError), transaction.atomic():
            Supplier.objects.get(pk=supplier["id"]).delete()
        self.assertEqual(self.client.delete(f"/api/documents/{obj.pk}/link/{link.data['id']}/").status_code, 204)
        self.assertEqual(DocumentLink.objects.count(), 1)
        self.assertEqual(self.client.get(f"/api/documents/?entity_type=invoice&entity_id={invoice['id']}").data["count"], 1)
        download = self.client.get(f"/api/documents/{obj.pk}/download/")
        self.assertEqual(download.status_code, 200)
        self.read_stream(download)

    def test_foreign_document_private_and_link_permissions(self):
        doc = self.upload()
        obj = Document.objects.get()
        self.post(f"/api/documents/{obj.pk}/link/", dict(entity_type="customer", entity_id=self.customer.pk))
        RolePermission.objects.filter(role=self.role, permission__code="customers.view").delete()
        self.assertEqual(self.client.get(f"/api/documents/{obj.pk}/download/").status_code, 404)
        self.assertEqual(self.client.get("/api/documents/").data["count"], 0)
        Document.objects.filter(pk=obj.pk).update(company=self.other_company)
        self.assertEqual(self.client.delete(f"/api/documents/{obj.pk}/").status_code, 404)
        self.assertEqual(self.post(f"/api/documents/{obj.pk}/link/", dict(entity_type="invoice", entity_id=1)).status_code, 404)
        private = self.upload()
        another = User.objects.create_user(email="private-owner@example.test")
        Document.objects.filter(pk=private.data["id"]).update(visibility="private", uploaded_by=another)
        self.assertEqual(self.client.get(f"/api/documents/{private.data['id']}/").status_code, 404)

    def test_delete_physical_file_tombstone_double_delete_and_link_after_delete(self):
        response = self.upload()
        obj = Document.objects.get(pk=response.data["id"])
        path = obj.file.path
        with self.captureOnCommitCallbacks(execute=True):
            result = self.client.delete(f"/api/documents/{obj.pk}/")
        self.assertEqual(result.status_code, 204)
        self.assertFalse(Path(path).exists())
        obj.refresh_from_db()
        self.assertIsNotNone(obj.file_deleted_at)
        self.assertEqual(self.client.get(f"/api/documents/{obj.pk}/download/").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/documents/{obj.pk}/").status_code, 409)
        self.assertEqual(self.post(f"/api/documents/{obj.pk}/link/", dict(entity_type="customer", entity_id=self.customer.pk)).status_code, 409)

    def test_storage_cleanup_on_metadata_failure_and_retry_deleted_file(self):
        with patch("apps.documents.services.Document.save", side_effect=RuntimeError("database failure")):
            with self.assertRaises(RuntimeError):
                self.upload()
        self.assertFalse(list(Path(self.storage.name).rglob("*.txt")))
        self.upload()
        obj = Document.objects.get()
        with patch.object(obj.file.storage, "delete", side_effect=OSError("storage unavailable")):
            with self.captureOnCommitCallbacks(execute=True):
                self.assertEqual(self.client.delete(f"/api/documents/{obj.pk}/").status_code, 204)
        obj.refresh_from_db()
        self.assertIsNone(obj.file_deleted_at)
        from django.core.management import call_command
        call_command("cleanup_document_files", verbosity=0)
        obj.refresh_from_db()
        self.assertIsNotNone(obj.file_deleted_at)

    def test_upload_delete_permissions_have_no_superuser_bypass(self):
        self.upload()
        obj = Document.objects.get()
        self.user.is_superuser = True
        self.user.save()
        RolePermission.objects.filter(role=self.role, permission__code__in=["documents.upload", "documents.delete", "documents.view"]).delete()
        self.assertEqual(self.upload().status_code, 403)
        self.assertEqual(self.client.get(f"/api/documents/{obj.pk}/download/").status_code, 403)
        self.assertEqual(self.client.delete(f"/api/documents/{obj.pk}/").status_code, 403)
