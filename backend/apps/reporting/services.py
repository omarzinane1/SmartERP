from django.core.files import File
from django.db import transaction
from apps.accounts.services import require_actor
from apps.accounts.selectors import get_effective_permission_codes
from common.dates import company_today
from .models import GeneratedExport
from .registry import dataset_spec, dataset_rows
from .exports import export_file


def generate_export(*, company, membership, data):
    for code in ("reports.generate", "reports.export"):
        require_actor(company=company, actor=membership, permission_code=code)
    values = dict(data)
    entity, format = values.pop("report_id"), values.pop("format")
    values["search"] = values.pop("filter", "") or values.get("search", "")
    spec = dataset_spec(entity, get_effective_permission_codes(membership=membership))
    filename = f"{entity}-{company_today(company).isoformat()}.{format}"
    stream = export_file([label for _, label in spec.columns], dataset_rows(company, spec, values), format)
    obj = GeneratedExport(company=company, entity=entity, format=format, filename=filename, requested_by_id=membership.user_id,
        filters={key: value.isoformat() if hasattr(value, "isoformat") else value for key, value in values.items()})
    try:
        with transaction.atomic():
            obj.file.save(filename, File(stream), save=False)
            obj.save()
    except Exception:
        if obj.file.name:
            obj.file.storage.delete(obj.file.name)
        raise
    finally:
        stream.close()
    return obj
