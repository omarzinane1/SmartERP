from .models import GeneratedExport
from .registry import DATASETS


def generated_queryset(company, permissions):
    allowed = [name for name, spec in DATASETS.items() if {spec.view, spec.export}.issubset(permissions)]
    if "reports.export" not in permissions:
        allowed = []
    return GeneratedExport.objects.filter(company=company, entity__in=allowed).select_related("requested_by")


def generated_payload(obj, request):
    return dict(id=str(obj.pk), reportId=obj.entity, name=DATASETS[obj.entity].title, createdAt=obj.created_at.isoformat(),
        generatedBy=obj.requested_by.get_full_name() or obj.requested_by.email, format=obj.format, status="ready", filename=obj.filename,
        downloadUrl=request.build_absolute_uri(f"/api/reports/generated/{obj.pk}/download/"), dateFrom=obj.filters.get("date_from", ""), dateTo=obj.filters.get("date_to", ""))


def catalog(company, permissions):
    latest = {}
    for obj in generated_queryset(company, permissions).order_by("entity", "-created_at", "-pk").distinct("entity"):
        latest[obj.entity] = obj
    result = []
    for name, spec in DATASETS.items():
        if spec.view not in permissions:
            continue
        record = latest.get(name)
        result.append(dict(id=name, name=spec.title, category="Exports ERP", description="Export des données enregistrées et filtrées de la société active.",
            formats=["csv", "xlsx"] if {spec.export, "reports.generate", "reports.export"}.issubset(permissions) else [], supportsPeriod=bool(spec.date),
            path=spec.path, canOpen=True, lastGenerated=record.created_at.isoformat() if record else None,
            generatedBy=(record.requested_by.get_full_name() or record.requested_by.email) if record else None))
    return result
