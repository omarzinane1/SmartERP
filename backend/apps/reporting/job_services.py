"""Durable background jobs: short claims, rendering outside database transactions."""
from datetime import timedelta
from io import BytesIO
import json
import logging
from uuid import uuid4
from django.core.files import File
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from apps.accounts.models import Membership
from apps.accounts.selectors import get_effective_permission_codes
from apps.audit.models import IdempotencyKey
from apps.companies.models import Company
from common.dispatch import enqueue_after_commit
from common.exceptions import BusinessConflict
from common.idempotency import request_identity
from common.pdf.commercial import render_commercial_pdf
from .models import AsyncJob
from .registry import DATASETS, dataset_spec, dataset_rows
from .exports import export_file
from .pdf_selectors import commercial_pdf_data
from .serializers import ExportInput

logger = logging.getLogger(__name__)
LEASE = timedelta(minutes=20)


def required_job_permissions(job):
    if job.job_type == "pdf_generation":
        if job.entity not in {"invoice", "quote"}:
            raise ValidationError("Type de PDF inconnu.")
        return {"reports.generate", "reports.export", "invoices.view"} if job.entity == "invoice" else {"reports.generate", "reports.export", "quotes.view", "quotes.export"}
    if job.entity not in DATASETS:
        raise ValidationError("Jeu de données inconnu.")
    spec = DATASETS[job.entity]
    return {"reports.view", "reports.generate", "reports.export", spec.view, spec.export}


def authorize_job(job):
    member = Membership.objects.select_related("user", "company").filter(company_id=job.company_id, user_id=job.requested_by_id, status="active", company__is_active=True, user__is_active=True).first()
    codes = get_effective_permission_codes(membership=member)
    if member is None or not required_job_permissions(job).issubset(codes):
        raise PermissionDenied("Accès au traitement révoqué.")
    return member, codes


def task_for(job_type):
    from .tasks import generate_report_export, generate_large_excel_export, generate_large_pdf
    return {"report_export": generate_report_export, "excel_export": generate_large_excel_export, "pdf_generation": generate_large_pdf}[job_type]


@transaction.atomic
def request_job(*, company, membership, data, key, pdf=False):
    Company.objects.select_for_update().get(pk=company.pk)
    if membership.company_id != company.pk:
        raise PermissionDenied()
    values = dict(data)
    if pdf:
        entity, target = values["entity_type"], values["entity_id"]
        kind, format, parameters = "pdf_generation", "pdf", {}
    else:
        entity, target, format = values.pop("report_id"), None, values.pop("format")
        kind = "excel_export" if format == "xlsx" else "report_export"
        values["search"] = values.pop("filter", "") or values.get("search", "")
        parameters = json.loads(json.dumps(values, cls=DjangoJSONEncoder))
    candidate = AsyncJob(company=company, requested_by_id=membership.user_id, job_type=kind, entity=entity, target_id=target, format=format, parameters=parameters)
    member, codes = authorize_job(candidate)
    key, fingerprint = request_identity(key, dict(user=member.user_id, kind=kind, entity=entity, target=target, format=format, parameters=parameters))
    receipt = IdempotencyKey.objects.filter(company=company, operation="async_job", key=key).first()
    if receipt:
        if receipt.actor_id != membership.user_id or receipt.request_hash != fingerprint:
            raise BusinessConflict("Clé déjà utilisée pour une autre demande.")
        return AsyncJob.objects.get(company=company, requested_by_id=membership.user_id, pk=receipt.response_body["job_id"])
    if pdf:
        # Validate ownership and read permissions now; worker validates again.
        from apps.sales.models import Invoice, Quote
        model = Invoice if entity == "invoice" else Quote
        if not model.objects.filter(company=company, pk=target, customer__company=company).exists():
            raise NotFound()
    else:
        spec = dataset_spec(entity, codes)
        serializer = ExportInput(data={**parameters, "format": format})
        serializer.is_valid(raise_exception=True)
        # Build the query to validate unsupported filters, without executing it.
        from .registry import dataset_query
        dataset_query(company, spec, serializer.validated_data)
    candidate.lease_expires_at = timezone.now()+timedelta(days=1)
    candidate.save()
    IdempotencyKey.objects.create(company=company, actor_id=membership.user_id, operation="async_job", key=key, request_hash=fingerprint,
        required_permissions=sorted(required_job_permissions(candidate)), response_code=202, response_body={"job_id": candidate.pk}, expires_at=timezone.now()+timedelta(days=30))
    enqueue_after_commit(task_for(kind), candidate.pk, failed=lambda: fail_job(candidate.pk, "broker_unavailable", "File de traitement indisponible. Vous pouvez réessayer."))
    return candidate


def fail_job(job_id, code, message, token=None):
    query = AsyncJob.objects.filter(pk=job_id, status__in=["pending", "processing"])
    if token is not None:
        query = query.filter(claim_token=token)
    query.update(status="failed", error_code=code, error_message=message, completed_at=timezone.now(), claim_token=None, lease_expires_at=None)


@transaction.atomic
def claim_job(job_id, expected_type):
    company_id = AsyncJob.objects.filter(pk=job_id).values_list("company_id", flat=True).first()
    if company_id is None:
        return None, dict(status="invalid", error="job_not_found")
    Company.objects.select_for_update().get(pk=company_id)
    obj = AsyncJob.objects.select_for_update(of=("self",)).select_related("company").filter(pk=job_id, company_id=company_id).first()
    if obj is None:
        return None, dict(status="invalid", error="job_not_found")
    if obj.job_type != expected_type:
        return None, dict(status="invalid", error="job_type_mismatch")
    if obj.status != "pending":
        return None, dict(status=obj.status, id=obj.pk)
    try:
        authorize_job(obj)
    except (PermissionDenied, ValidationError):
        fail_job(obj.pk, "access_revoked", "Accès au traitement révoqué.")
        return None, dict(status="failed", id=obj.pk)
    obj.status, obj.claim_token = "processing", uuid4()
    obj.started_at, obj.lease_expires_at = timezone.now(), timezone.now()+LEASE
    obj.attempts += 1
    obj.save(update_fields=["status", "claim_token", "started_at", "lease_expires_at", "attempts"])
    return obj, None


def render_job(job):
    membership, codes = authorize_job(job)
    if job.job_type == "pdf_generation":
        data = commercial_pdf_data(job.company, membership, job.entity, job.target_id)
        return BytesIO(render_commercial_pdf(data)), f"{data['number']}.pdf"
    serializer = ExportInput(data={**job.parameters, "format": job.format})
    serializer.is_valid(raise_exception=True)
    spec = dataset_spec(job.entity, codes)
    stream = export_file([label for _, label in spec.columns], dataset_rows(job.company, spec, serializer.validated_data), job.format)
    return stream, f"{job.entity}-{job.pk}.{job.format}"


def transient_storage_error(error):
    import errno
    return isinstance(error, TimeoutError) or isinstance(error, OSError) and error.errno in {errno.EAGAIN, errno.ETIMEDOUT, errno.ECONNRESET, errno.ECONNREFUSED, errno.ENETUNREACH, errno.EHOSTUNREACH}


def execute_job(task, job_id, expected_type):
    if type(job_id) is not int or job_id < 1:
        return dict(status="invalid", error="invalid_id")
    job, result = claim_job(job_id, expected_type)
    if job is None:
        return result
    logger.info("async_job_started company_id=%s job_id=%s type=%s", job.company_id, job.pk, job.job_type)
    stream, saved_name = None, None
    try:
        stream, filename = render_job(job)
        job.result_file.save(filename, File(stream), save=False)
        saved_name = job.result_file.name
        # Company first, then job: same lock order as request creation and notifications.
        with transaction.atomic():
            Company.objects.select_for_update().get(pk=job.company_id)
            current = AsyncJob.objects.select_for_update().get(pk=job.pk)
            if current.status != "processing" or current.claim_token != job.claim_token or current.lease_expires_at < timezone.now():
                raise BusinessConflict("Traitement expiré ou remplacé.")
            authorize_job(current)
            current.result_file, current.filename, current.status = saved_name, filename, "completed"
            current.completed_at, current.claim_token, current.lease_expires_at = timezone.now(), None, None
            current.save(update_fields=["result_file", "filename", "status", "completed_at", "claim_token", "lease_expires_at"])
            from apps.notifications.services import create_notification
            create_notification(company=job.company, recipient_id=job.requested_by_id, type="export_completed", title="Fichier disponible",
                message="Votre traitement est terminé. Le fichier est disponible dans vos rapports.", entity_type="job", entity_id=job.pk,
                dedupe_key=f"job_completed:{job.pk}", permissions=required_job_permissions(job))
        logger.info("async_job_completed company_id=%s job_id=%s", job.company_id, job.pk)
        return dict(status="completed", id=job.pk)
    except Exception as error:
        # Never expose exception text or a traceback in the job or broker payload.
        if saved_name:
            try:
                job.result_file.storage.delete(saved_name)
            except OSError:
                logger.error("async_job_file_cleanup_failed company_id=%s job_id=%s", job.company_id, job.pk)
        retryable = transient_storage_error(error) and task.request.retries < task.max_retries
        if retryable:
            changed = AsyncJob.objects.filter(pk=job.pk, claim_token=job.claim_token, status="processing").update(status="pending", claim_token=None, lease_expires_at=timezone.now()+timedelta(days=1))
            if changed:
                logger.warning("async_job_retry company_id=%s job_id=%s error_type=%s", job.company_id, job.pk, type(error).__name__)
                raise task.retry(countdown=30*(2**task.request.retries))
        fail_job(job.pk, "generation_failed", "Le fichier n’a pas pu être généré. Vérifiez vos droits et les données sélectionnées.", token=job.claim_token)
        logger.error("async_job_failed company_id=%s job_id=%s error_type=%s", job.company_id, job.pk, type(error).__name__)
        return dict(status="failed", id=job.pk)
    finally:
        if stream:
            stream.close()


def expire_jobs(query=None):
    from django.db.models import Q
    query = query if query is not None else AsyncJob.objects.all()
    now = timezone.now()
    expired = Q(lease_expires_at__lt=now) | Q(lease_expires_at__isnull=True, created_at__lt=now-timedelta(days=1))
    return query.filter(status__in=["pending", "processing"]).filter(expired).update(
        status="failed", error_code="execution_expired", error_message="Traitement interrompu ou worker indisponible. Vous pouvez réessayer.", completed_at=now, claim_token=None, lease_expires_at=None)


@transaction.atomic
def retry_job(*, company, membership, job_id):
    Company.objects.select_for_update().get(pk=company.pk)
    if membership.company_id != company.pk:
        raise PermissionDenied()
    obj = AsyncJob.objects.select_for_update().filter(company=company, requested_by_id=membership.user_id, pk=job_id).first()
    if obj is None:
        raise NotFound()
    authorize_job(obj)
    expire_jobs(AsyncJob.objects.filter(pk=obj.pk))
    obj.refresh_from_db()
    if obj.status != "failed":
        raise BusinessConflict("Seul un traitement en échec peut être relancé.")
    obj.status, obj.error_code, obj.error_message = "pending", "", ""
    obj.started_at, obj.completed_at = None, None
    # Reset queue age for a deliberate user retry, without rewriting creation history.
    obj.lease_expires_at = timezone.now()+timedelta(days=1)
    obj.save(update_fields=["status", "error_code", "error_message", "started_at", "completed_at", "lease_expires_at"])
    enqueue_after_commit(task_for(obj.job_type), obj.pk, failed=lambda: fail_job(obj.pk, "broker_unavailable", "File de traitement indisponible."))
    return obj
