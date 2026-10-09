"""Real local Valkey/worker check, console email only, disposable owned fixture.

Never contacts SMTP. Creates its own company/user/invoice, verifies the MIME
output and persistent delivery state, then removes only these test records.
"""
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
from urllib.parse import urlsplit
from uuid import uuid4

from check_celery_broker import BACKEND, wait_for

os.environ.update(EMAIL_BACKEND="django.core.mail.backends.console.EmailBackend", EMAIL_DELIVERY_ENABLED="true",
    DEFAULT_FROM_EMAIL="noreply@example.test", DJANGO_SETTINGS_MODULE="config.settings.development", PYTHONUTF8="1", PYTHONIOENCODING="utf-8")


def create_fixture(identity):
    from django.db import transaction
    from django.utils import timezone
    from apps.accounts.models import User, Membership, Role, MembershipRole, RolePermission, Permission
    from apps.companies.models import Company
    from apps.crm.models import Customer
    from apps.sales.models import Invoice, InvoiceLine
    from apps.notifications.email_services import prepare_email
    with transaction.atomic():
        company = Company.objects.create(name=f"Email worker smoke {identity}")
        user = User.objects.create_user(email=f"smoke-{identity}@example.test")
        member = Membership.objects.create(company=company, user=user)
        role = Role.objects.create(company=company, code="smoke", name="Local email validation")
        MembershipRole.objects.create(membership=member, role=role)
        for code in ["invoices.view", "invoices.send"]:
            RolePermission.objects.create(role=role, permission=Permission.objects.get(code=code))
        customer = Customer.objects.create(company=company, name="Client de validation locale", reference="SMOKE", type="company", city="Rabat", email=f"recipient-{identity}@example.test", salesperson=member)
        invoice = Invoice.objects.create(company=company, customer=customer, salesperson=member, number=f"LOCAL-{identity[:12]}",
            issue_date=timezone.localdate(), due_date=timezone.localdate(), status="posted", issued_at=timezone.now(), gross_total=100, subtotal=100, total=100, balance_due=100)
        InvoiceLine.objects.create(company=company, invoice=invoice, position=1, product_name="Validation console locale", quantity=1, unit_price=100,
            gross_total=100, discount_total=0, subtotal=100, tax_total=0, line_total=100)
        email = prepare_email(company=company, email_type="invoice", entity_type="invoice", entity_id=invoice.pk,
            requested_by_id=user.pk, dedupe_key=f"invoice:initial:{invoice.pk}", publish=False)
    return company.pk, user.pk, email.pk


def cleanup_fixture(company_id, user_id, identity):
    from django.db import transaction
    from apps.accounts.models import User, Membership, Role, MembershipRole, RolePermission
    from apps.companies.models import Company
    from apps.crm.models import Customer
    from apps.sales.models import Invoice, InvoiceLine
    from apps.notifications.models import BusinessEmail
    from apps.audit.models import AuditLog
    with transaction.atomic():
        company = Company.objects.get(pk=company_id, name=f"Email worker smoke {identity}")
        for model in [AuditLog, BusinessEmail, InvoiceLine, Invoice, Customer]:
            model.objects.filter(company=company).delete()
        RolePermission.objects.filter(role__company=company).delete()
        MembershipRole.objects.filter(membership__company=company).delete()
        Role.objects.filter(company=company).delete()
        Membership.objects.filter(company=company, user_id=user_id).delete()
        User.objects.get(pk=user_id, email=f"smoke-{identity}@example.test").delete()
        company.delete()


def main():
    import django
    django.setup()
    from config import celery_app
    from redis import Redis
    from apps.notifications.models import BusinessEmail
    from apps.notifications.tasks import send_business_email_task
    address = urlsplit(celery_app.conf.broker_url or "")
    if address.scheme != "redis" or address.hostname not in {"localhost", "127.0.0.1", "::1"} or celery_app.conf.task_always_eager:
        raise RuntimeError("A real local Valkey broker and non-eager worker are required.")
    with Redis.from_url(celery_app.conf.broker_url, socket_connect_timeout=3, socket_timeout=3) as client:
        assert client.ping()
    print("Valkey PING: PONG", flush=True)
    identity = uuid4().hex
    company_id, user_id, email_id = create_fixture(identity)
    queue, hostname = f"email-smoke-{identity}", f"email-smoke-{identity}@localhost"
    try:
        with TemporaryDirectory(prefix="smarterp-email-worker-") as directory:
            log_path = Path(directory) / "worker.log"
            command = [sys.executable, "-m", "celery", "-A", "config", "worker", "--loglevel=INFO", "--pool=solo", "--concurrency=1",
                "--hostname", hostname, "--queues", queue, "--without-gossip", "--without-mingle", "--without-heartbeat", "--logfile", str(log_path)]
            process = subprocess.Popen(command, cwd=BACKEND, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
            try:
                wait_for(log_path, lambda log: "Connected to redis://" in log and f"{hostname} ready." in log, process)
                print("Worker: connected and ready (solo)", flush=True)
                result = send_business_email_task.apply_async(args=[email_id], queue=queue, retry=False)
                marker = f"Task {send_business_email_task.name}[{result.id}]"
                wait_for(log_path, lambda log: marker+" received" in log and marker+" succeeded" in log, process, timeout=45)
                email = BusinessEmail.objects.get(pk=email_id, company_id=company_id)
                if email.status != "sent" or email.email_sent_at is None or email.backend != "django.core.mail.backends.console.EmailBackend":
                    raise RuntimeError(f"Console delivery failed: status={email.status} code={email.email_error_code}")
                log = log_path.read_text(encoding="utf-8", errors="replace")
                for mime in ["text/plain", "text/html", "application/pdf"]:
                    if f"Content-Type: {mime}" not in log:
                        raise RuntimeError(f"Missing MIME part: {mime}")
                for line in log.splitlines():
                    if marker+" received" in line or marker+" succeeded" in line:
                        print(line, flush=True)
                print("BusinessEmail: sent; sent timestamp persisted; backend=console\nMIME: text/plain + text/html + invoice PDF verified\nExternal SMTP: NOT USED", flush=True)
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
        cleanup_fixture(company_id, user_id, identity)
        print("Owned disposable company/user/invoice/email/audit records removed", flush=True)


if __name__ == "__main__":
    main()
