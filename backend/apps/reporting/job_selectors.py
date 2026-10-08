from django.db.models import Q
from rest_framework.exceptions import NotFound
from apps.accounts.selectors import get_effective_permission_codes
from .models import AsyncJob
from .registry import DATASETS
from .job_services import required_job_permissions


def job_queryset(company, membership):
    query = AsyncJob.objects.filter(company=company, requested_by_id=membership.user_id)
    if membership.company_id != company.pk or not company.is_active or membership.status != "active" or not membership.user.is_active:
        return query.none()
    codes = get_effective_permission_codes(membership=membership)
    allowed = Q(pk__in=[])
    for kind, entities in [("report_export", DATASETS), ("excel_export", DATASETS), ("pdf_generation", ["invoice", "quote"])]:
        for entity in entities:
            if required_job_permissions(AsyncJob(job_type=kind, entity=entity)).issubset(codes):
                allowed |= Q(job_type=kind, entity=entity)
    return query.filter(allowed)


def owned_job(company, membership, job_id):
    obj = job_queryset(company, membership).filter(pk=job_id).first()
    if obj is None:
        raise NotFound()
    return obj


def job_payload(obj):
    return dict(id=obj.pk, status=obj.status, job_type=obj.job_type, entity=obj.entity, target_id=obj.target_id, format=obj.format,
        created_at=obj.created_at, started_at=obj.started_at, completed_at=obj.completed_at, filename=obj.filename or None, parameters=obj.parameters,
        error_code=obj.error_code or None, error_message=obj.error_message or None,
        download_url=f"/api/jobs/{obj.pk}/download/" if obj.status == "completed" else None)
