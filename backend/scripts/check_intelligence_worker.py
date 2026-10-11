"""Validate a real local worker with one owned, disposable overdue invoice.

Does not read or modify existing ERP records. No LLM, email or result backend.
The owned worker and UUID-tagged fixtures are cleaned up after verification.
"""
from datetime import timedelta
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
from unittest.mock import patch
from urllib.parse import urlsplit
from uuid import uuid4
from check_celery_broker import BACKEND, wait_for

os.environ.update(DJANGO_SETTINGS_MODULE="config.settings.development", EMAIL_DELIVERY_ENABLED="false", PYTHONUTF8="1", PYTHONIOENCODING="utf-8")


def fixture(identity):
    from django.db import transaction
    from django.utils import timezone
    from apps.accounts.models import User, Membership, Role, MembershipRole, RolePermission, Permission
    from apps.companies.models import Company
    from apps.crm.models import Customer
    from apps.sales.models import Invoice
    with transaction.atomic():
        company = Company.objects.create(name=f"Intelligence smoke {identity}")
        user = User.objects.create_user(email=f"intelligence-{identity}@example.test")
        member = Membership.objects.create(company=company, user=user)
        role = Role.objects.create(company=company, code="smoke", name="Intelligence validation")
        MembershipRole.objects.create(membership=member, role=role)
        for code in ["ai.use", "invoices.view"]:
            RolePermission.objects.create(role=role, permission=Permission.objects.get(code=code))
        customer = Customer.objects.create(company=company, name="Local smoke", reference="LOCAL", type="company", salesperson=member)
        invoice = Invoice.objects.create(company=company, customer=customer, salesperson=member, number=f"LOCAL-{identity[:12]}",
            issue_date=timezone.localdate()-timedelta(days=2), due_date=timezone.localdate()-timedelta(days=1), status="posted", issued_at=timezone.now(),
            gross_total=100, subtotal=100, total=100, balance_due=100)
    return company, member, invoice.pk


def cleanup(company_id, user_id, identity):
    from django.db import transaction
    from apps.accounts.models import User, Membership, MembershipRole, RolePermission, Role
    from apps.audit.models import AuditLog, IdempotencyKey
    from apps.companies.models import Company
    from apps.crm.models import Customer
    from apps.sales.models import Invoice
    from apps.intelligence.models import AIAlert, IntelligenceRun
    with transaction.atomic():
        company = Company.objects.get(pk=company_id, name=f"Intelligence smoke {identity}")
        for model in [AuditLog, IdempotencyKey, AIAlert, IntelligenceRun, Invoice, Customer]:
            model.objects.filter(company=company).delete()
        RolePermission.objects.filter(role__company=company).delete()
        MembershipRole.objects.filter(membership__company=company).delete()
        Role.objects.filter(company=company).delete()
        Membership.objects.filter(company=company, user_id=user_id).delete()
        User.objects.get(pk=user_id, email=f"intelligence-{identity}@example.test").delete()
        company.delete()


def main():
    import django
    django.setup()
    from config import celery_app
    from redis import Redis
    from apps.intelligence.tasks import run_company_intelligence
    from apps.intelligence.services import request_refresh
    from apps.intelligence.models import AIAlert
    from apps.sales.models import Invoice
    address = urlsplit(celery_app.conf.broker_url or "")
    if address.scheme != "redis" or address.hostname not in {"127.0.0.1", "localhost", "::1"} or celery_app.conf.task_always_eager:
        raise RuntimeError("Requires real local Valkey and non-eager settings.")
    with Redis.from_url(celery_app.conf.broker_url, socket_connect_timeout=3, socket_timeout=3) as client:
        assert client.ping()
    print("Valkey PING: PONG", flush=True)
    identity = uuid4().hex
    company, member, invoice_id = fixture(identity)
    queue, hostname = f"intelligence-smoke-{identity}", f"intelligence-smoke-{identity}@localhost"
    try:
        with TemporaryDirectory(prefix="smarterp-intelligence-") as directory:
            log_path = Path(directory)/"worker.log"
            command = [sys.executable, "-m", "celery", "-A", "config", "worker", "--loglevel=INFO", "--pool=solo", "--concurrency=1",
                "--hostname", hostname, "--queues", queue, "--without-gossip", "--without-mingle", "--without-heartbeat", "--logfile", str(log_path)]
            process = subprocess.Popen(command, cwd=BACKEND, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
            try:
                wait_for(log_path, lambda log: "Connected to redis://" in log and f"{hostname} ready." in log, process)
                print("Worker connected and ready (solo)", flush=True)
                original, sent = run_company_intelligence.apply_async, []
                def publish(*args, **kwargs):
                    result = original(*args, **kwargs, queue=queue)
                    sent.append(result.id)
                    return result
                with patch.object(run_company_intelligence, "apply_async", side_effect=publish):
                    run = request_refresh(company=company, membership=member, key=f"smoke-{identity}")
                marker = f"Task {run_company_intelligence.name}[{sent[0]}]"
                wait_for(log_path, lambda log: marker+" received" in log and marker+" succeeded" in log, process)
                run.refresh_from_db()
                assert run.status == "completed" and run.summary["created"] == 1
                assert AIAlert.objects.filter(company=company, entity_id=invoice_id, alert_type="overdue_invoice", status="open").count() == 1
                assert Invoice.objects.get(pk=invoice_id, company=company).balance_due == 100
                for line in log_path.read_text(encoding="utf-8", errors="replace").splitlines():
                    if marker+" received" in line or marker+" succeeded" in line:
                        print(line, flush=True)
                print("IntelligenceRun: completed; one overdue alert persisted; ERP balance unchanged", flush=True)
            finally:
                if process.poll() is None:
                    try:
                        celery_app.control.broadcast("shutdown", destination=[hostname])
                    except Exception:
                        pass
                    try:
                        process.wait(timeout=15)
                    except subprocess.TimeoutExpired:
                        process.terminate()
                        process.wait(timeout=10)
                print("Owned diagnostic worker stopped", flush=True)
    finally:
        cleanup(company.pk, member.user_id, identity)
        print("Owned disposable fixtures removed", flush=True)


if __name__ == "__main__":
    main()
