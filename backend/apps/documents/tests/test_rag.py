from datetime import timedelta
from unittest.mock import patch
from io import BytesIO
from uuid import uuid4
from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from django.db import connection
from rest_framework.exceptions import PermissionDenied
from reportlab.pdfgen.canvas import Canvas
from apps.accounts.models import Permission, RolePermission, User
from apps.documents.models import Document, DocumentChunk, DocumentLink
from apps.documents.rag.indexer import request_index, ingest
from apps.documents.rag.retriever import retrieve
from apps.documents.parsers import extract_pages
from apps.documents.chunking import chunk_pages
from apps.intelligence.assistant import make_context
from apps.intelligence.llm import AIError
from common.tests.async_support import AsyncDataMixin


class FakeEmbeddings:
    def __init__(self, **kwargs): pass
    def identity(self): return "embeddinggemma:300m", "a"*64
    def embed_texts(self, texts): return [[1.0]+[0.0]*767 for _ in texts]
    def embed_text(self, text): return [1.0]+[0.0]*767


class RAGDataMixin(AsyncDataMixin):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        for code in ["ai.use", "ai.tools.finance", "ai.tools.inventory", "documents.ai_analyze"]:
            RolePermission.objects.get_or_create(role=cls.role, permission=Permission.objects.get(code=code))

    def doc(self, content="Le paiement intervient à trente jours.", **values):
        data = content.encode()
        return Document.objects.create(company=self.company, uploaded_by=self.user, name="Contrat", original_filename="contrat.txt",
            mime_type="text/plain", size=len(data), file=SimpleUploadedFile("contrat.txt", data), **values)

    def index(self, obj):
        with patch("apps.documents.rag.indexer.EmbeddingProvider", FakeEmbeddings), self.captureOnCommitCallbacks(execute=True):
            request_index(company=self.company, membership=self.membership, document_id=obj.pk)
        obj.refresh_from_db()
        self.assertEqual(obj.rag_status, "indexed", obj.rag_error)
        return obj


class RAGTests(RAGDataMixin, TestCase):
    def test_extension_real_insert_and_similarity(self):
        with connection.cursor() as cursor:
            cursor.execute("SELECT extversion FROM pg_extension WHERE extname='vector'")
            self.assertTrue(cursor.fetchone())
        obj = self.index(self.doc())
        self.assertEqual(len(obj.chunks.get().embedding), 768)
        with patch("apps.documents.rag.retriever.EmbeddingProvider", FakeEmbeddings):
            rows = retrieve(make_context(self.company, self.membership), "paiement")
        self.assertEqual(rows[0]["document_id"], obj.pk)
        self.assertEqual(rows[0]["distance"], 0)

    def test_reindex_atomic_replaces_and_duplicate_delivery_noop(self):
        obj = self.index(self.doc())
        first = obj.chunks.get().pk
        self.index(obj)
        self.assertEqual(obj.chunks.count(), 1)
        self.assertNotEqual(obj.chunks.get().pk, first)
        with patch("apps.documents.rag.indexer.EmbeddingProvider") as provider:
            ingest(obj.pk)
            provider.assert_not_called()

    def test_provider_failure_never_publishes_partial_vectors(self):
        obj = self.index(self.doc())
        with patch("apps.documents.rag.indexer.EmbeddingProvider", side_effect=AIError("provider_timeout")), self.captureOnCommitCallbacks(execute=True):
            request_index(company=self.company, membership=self.membership, document_id=obj.pk)
        obj.refresh_from_db()
        self.assertEqual(obj.rag_status, "failed")
        self.assertEqual(obj.rag_error, "provider_timeout")
        with patch("apps.documents.rag.retriever.EmbeddingProvider", FakeEmbeddings):
            self.assertEqual(retrieve(make_context(self.company, self.membership), "paiement"), [])

    def test_pdf_text_extraction_and_scanned_no_ocr(self):
        obj = self.doc()
        stream = BytesIO()
        pdf = Canvas(stream)
        pdf.drawString(20, 100, "Payment within thirty days")
        pdf.save()
        obj.file.save("page.pdf", SimpleUploadedFile("page.pdf", stream.getvalue()))
        obj.mime_type = "application/pdf"
        self.assertIn("thirty", extract_pages(obj)[0][1])
        from pypdf import PdfWriter
        stream = BytesIO()
        writer = PdfWriter()
        writer.add_blank_page(width=100, height=100)
        writer.write(stream)
        obj.file.save("scan.pdf", SimpleUploadedFile("scan.pdf", stream.getvalue()))
        with self.assertRaisesRegex(AIError, "no_extractable_text"):
            extract_pages(obj)

    def test_unsupported_and_empty(self):
        obj = self.doc()
        obj.mime_type = "image/png"
        with self.assertRaisesRegex(AIError, "unsupported_format"):
            extract_pages(obj)
        with self.assertRaisesRegex(AIError, "no_extractable_text"):
            chunk_pages([(1, "   ")])

    def test_chunk_limits_unicode_and_page_metadata(self):
        chunks = chunk_pages([(3, "échéance "*1000)])
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(len(c["content"].encode()) <= 1200 and c["page_number"] == 3 for c in chunks))

    def test_company_private_link_permissions_filtered_before_topk(self):
        foreign = self.index(self.doc("Foreign secret"))
        Document.objects.filter(pk=foreign.pk).update(company=self.other_company)
        private = self.index(self.doc("Private secret"))
        another = User.objects.create_user(email="private-rag@example.test")
        Document.objects.filter(pk=private.pk).update(visibility="private", uploaded_by=another)
        linked = self.index(self.doc("Linked secret"))
        DocumentLink.objects.create(company=self.company, document=linked, entity_type="customer", entity_id=self.customer.pk, created_by=self.user)
        RolePermission.objects.filter(role=self.role, permission__code="customers.view").delete()
        allowed = self.index(self.doc("Public authorized"))
        with patch("apps.documents.rag.retriever.EmbeddingProvider", FakeEmbeddings):
            rows = retrieve(make_context(self.company, self.membership), "contrat", top_k=1)
        self.assertEqual([r["document_id"] for r in rows], [allowed.pk])

    def test_embedding_model_change_excluded(self):
        obj = self.index(self.doc())
        obj.chunks.update(embedding_digest="b"*64)
        with patch("apps.documents.rag.retriever.EmbeddingProvider", FakeEmbeddings):
            self.assertEqual(retrieve(make_context(self.company, self.membership), "contrat"), [])

    def test_invalid_topk_and_missing_document_permission(self):
        ctx = make_context(self.company, self.membership)
        with self.assertRaisesRegex(AIError, "invalid_top_k"):
            retrieve(ctx, "contrat", top_k=1000000)
        RolePermission.objects.filter(role=self.role, permission__code="documents.view").delete()
        with self.assertRaises(PermissionDenied):
            retrieve(ctx, "contrat")

    def test_revoked_ingestion_actor_and_foreign_index(self):
        obj = self.doc()
        request_index(company=self.company, membership=self.membership, document_id=obj.pk)
        RolePermission.objects.filter(role=self.role, permission__code="documents.view").delete()
        ingest(obj.pk)
        obj.refresh_from_db()
        self.assertEqual(obj.rag_status, "failed")
        self.assertEqual(obj.chunks.count(), 0)

    def test_document_ai_permission_required_for_index_and_retrieval(self):
        obj = self.index(self.doc())
        RolePermission.objects.filter(role=self.role, permission__code="documents.ai_analyze").delete()
        with patch("apps.documents.rag.retriever.EmbeddingProvider") as provider:
            with self.assertRaises(PermissionDenied):
                retrieve(make_context(self.company, self.membership), "contrat")
            provider.assert_not_called()
        with self.assertRaises(PermissionDenied):
            request_index(company=self.company, membership=self.membership, document_id=obj.pk)

    def test_upload_schedules_after_commit_and_index_endpoint(self):
        with override_settings(OLLAMA_BASE_URL="http://localhost:11434", OLLAMA_CHAT_MODEL="chat", OLLAMA_EMBEDDING_MODEL="embeddinggemma:300m"), patch("apps.documents.rag.indexer.EmbeddingProvider", FakeEmbeddings), self.captureOnCommitCallbacks(execute=True):
            response = self.client.post("/api/documents/", dict(file=SimpleUploadedFile("test.txt", b"Contract payment terms"), category="", department="", visibility="Public entreprise"), format="multipart")
        self.assertEqual(response.status_code, 201, response.data)
        obj = Document.objects.get(pk=response.data["id"])
        self.assertEqual(obj.rag_status, "indexed")
        response = self.client.post(f"/api/documents/{obj.pk}/index/", {"company_id": self.other_company.pk}, format="json")
        self.assertIn(response.status_code, [400, 403])

    def test_relevance_order_duplicate_content_and_delete_cleanup(self):
        from apps.documents.services import delete_document
        closest = self.index(self.doc("Terme exact"))
        other = self.index(self.doc("Terme secondaire"))
        other.chunks.update(embedding=[0.8, 0.6]+[0.0]*766)
        with patch("apps.documents.rag.retriever.EmbeddingProvider", FakeEmbeddings):
            rows = retrieve(make_context(self.company, self.membership), "Terme", top_k=2)
            self.assertEqual([r["document_id"] for r in rows], [closest.pk, other.pk])
            other.chunks.update(content="Terme exact")
            self.assertEqual(len(retrieve(make_context(self.company, self.membership), "Terme", top_k=2)), 1)
        with self.captureOnCommitCallbacks(execute=True):
            delete_document(company=self.company, membership=self.membership, document_id=closest.pk)
        self.assertEqual(closest.chunks.count(), 0)

    def test_reindex_lease_and_midflight_delete_fenced(self):
        obj = self.doc()
        request_index(company=self.company, membership=self.membership, document_id=obj.pk)
        Document.objects.filter(pk=obj.pk).update(rag_status="processing", rag_lease_until=timezone.now()-timedelta(seconds=1))
        self.index(obj)
        class DeleteDuringEmbedding(FakeEmbeddings):
            def embed_texts(inner, texts):
                Document.objects.filter(pk=obj.pk).update(deleted_at=timezone.now())
                return super().embed_texts(texts)
        first_ids = list(obj.chunks.values_list("pk", flat=True))
        with patch("apps.documents.rag.indexer.EmbeddingProvider", DeleteDuringEmbedding), self.captureOnCommitCallbacks(execute=True):
            request_index(company=self.company, membership=self.membership, document_id=obj.pk)
        self.assertEqual(list(obj.chunks.values_list("pk", flat=True)), first_ids)

    def test_known_credential_patterns_removed_before_embeddings(self):
        obj = self.index(self.doc("Délai : trente jours.\napi_key: SENTINEL_PRIVATE_VALUE\nFin du contrat."))
        self.assertNotIn("SENTINEL_PRIVATE_VALUE", obj.chunks.get().content)
        self.assertIn("[retiré]", obj.chunks.get().content)
