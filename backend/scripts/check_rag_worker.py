"""Real local Celery + Ollama + pgvector + Assistant check on UUID-owned fixtures.

Does not read existing ERP data. Stops its dedicated worker and removes its own
document, conversation and company fixtures even if a model response fails.
"""
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
from unittest.mock import patch
from urllib.parse import urlsplit
from uuid import uuid4
from check_celery_broker import BACKEND, wait_for
from check_intelligence_worker import fixture, cleanup

os.environ.update(DJANGO_SETTINGS_MODULE="config.settings.development", EMAIL_DELIVERY_ENABLED="false", PYTHONUTF8="1", PYTHONIOENCODING="utf-8")


def main():
    import django
    django.setup()
    from config import celery_app
    from redis import Redis
    from django.core.files.uploadedfile import SimpleUploadedFile
    from apps.accounts.models import Role, RolePermission, Permission
    from apps.documents.services import upload_document
    from apps.documents.models import Document, DocumentChunk
    from apps.documents.tasks import index_document
    from apps.documents.rag.retriever import retrieve
    from apps.intelligence.assistant import make_context, create_conversation, chat
    from apps.intelligence.models import AIConversation
    from apps.sales.models import Invoice
    broker = urlsplit(celery_app.conf.broker_url or "")
    if broker.scheme != "redis" or broker.hostname not in {"localhost", "127.0.0.1", "::1"} or celery_app.conf.task_always_eager:
        raise RuntimeError("Requires local Valkey with a real worker.")
    with Redis.from_url(celery_app.conf.broker_url, socket_connect_timeout=3, socket_timeout=3) as client:
        assert client.ping()
    identity = uuid4().hex
    company, member, invoice_id = fixture(identity)
    queue, hostname = f"rag-smoke-{identity}", f"rag-smoke-{identity}@localhost"
    try:
        role = Role.objects.get(company=company)
        for code in ["documents.view", "documents.upload", "documents.ai_analyze", "ai.tools.finance"]:
            RolePermission.objects.get_or_create(role=role, permission=Permission.objects.get(code=code))
        with TemporaryDirectory(prefix="smarterp-rag-worker-") as directory:
            log_path = Path(directory)/"worker.log"
            command = [sys.executable, "-m", "celery", "-A", "config", "worker", "--loglevel=INFO", "--pool=solo", "--concurrency=1",
                "--hostname", hostname, "--queues", queue, "--without-gossip", "--without-mingle", "--without-heartbeat", "--logfile", str(log_path)]
            process = subprocess.Popen(command, cwd=BACKEND, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
            try:
                wait_for(log_path, lambda log: f"{hostname} ready." in log, process, timeout=90)
                print("Valkey PONG; dedicated Celery worker ready", flush=True)
                original, sent = index_document.apply_async, []
                def publish(*args, **kwargs):
                    result = original(*args, **kwargs, queue=queue)
                    sent.append(result.id)
                    return result
                with patch.object(index_document, "apply_async", side_effect=publish):
                    document = upload_document(company=company, membership=member, data=dict(file=SimpleUploadedFile("contrat-validation.txt",
                        "Contrat de validation. Le paiement est exigible à trente jours après réception de la facture. Aucune pénalité n'est prévue dans ce document.".encode()),
                        category="Contrats", department="Finance", visibility="Public entreprise"))
                marker = f"Task {index_document.name}[{sent[0]}]"
                wait_for(log_path, lambda log: marker+" succeeded" in log, process, timeout=180)
                document.refresh_from_db()
                assert document.rag_status == "indexed", document.rag_error
                chunk = document.chunks.get()
                assert len(chunk.embedding) == 768
                ctx = make_context(company, member)
                rows = retrieve(ctx, "Quel est le délai de paiement ?", document_id=document.pk)
                assert rows and rows[0]["document_id"] == document.pk
                print(f"Document indexed; chunks=1; dimension=768; real cosine distance={rows[0]['distance']:.6f}", flush=True)
                conversation = create_conversation(make_context(company, member))
                result = chat(make_context(company, member), conversation.pk,
                    f"Que dit le document {document.pk} sur le délai de paiement ?")
                from apps.audit.models import AuditLog
                print("Graph diagnostics:", list(AuditLog.objects.filter(company=company, entity_type="aiassistant").values_list("action", "metadata")), flush=True)
                assert result["status"] == "completed", result.get("errorCode", result["status"])
                assert result["sources"] and result["sources"][0]["documentId"] == document.pk
                answer = " ".join(b.get("text", "") for b in result["blocks"])
                assert "trente" in answer.casefold() or "30" in answer
                print("Real LangGraph RAG answer supported by the synthetic contract, citation verified", flush=True)
                result = chat(make_context(company, member), create_conversation(make_context(company, member)).pk, "Quel est notre chiffre d'affaires ce mois ?")
                assert result["status"] == "completed" and "revenue" in result["tools"], result.get("errorCode", result["status"])
                assert Invoice.objects.get(company=company, pk=invoice_id).balance_due == 100
                print("Real LangGraph TOOL revenue selected; invoice balance unchanged", flush=True)
                result = chat(make_context(company, member), create_conversation(make_context(company, member)).pk,
                    f"Quel est notre chiffre d'affaires ce mois et que dit le document {document.pk} sur le délai de paiement ?")
                assert result["status"] == "completed" and "revenue" in result["tools"], result.get("errorCode", result["status"])
                assert result["sources"] and result["sources"][0]["documentId"] == document.pk
                assert Invoice.objects.get(company=company, pk=invoice_id).balance_due == 100
                print("Real LangGraph HYBRID revenue + document citation verified; no ERP mutation", flush=True)
            finally:
                if process.poll() is None:
                    try:
                        celery_app.control.broadcast("shutdown", destination=[hostname])
                        process.wait(timeout=15)
                    except Exception:
                        process.terminate()
                        process.wait(timeout=10)
                print("Owned RAG worker stopped", flush=True)
    finally:
        AIConversation.objects.filter(company=company).delete()
        for document in Document.objects.filter(company=company):
            document.file.delete(save=False)
        DocumentChunk.objects.filter(company=company).delete()
        Document.objects.filter(company=company).delete()
        cleanup(company.pk, member.user_id, identity)
        print("Owned synthetic fixtures removed", flush=True)


if __name__ == "__main__":
    main()
