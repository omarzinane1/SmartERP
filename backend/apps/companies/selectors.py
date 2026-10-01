from .models import CompanyModule


def get_enabled_module_codes(*, company):
    return list(
        CompanyModule.objects.filter(
            company=company, is_active=True, module__is_active=True,
        ).order_by("module__code").values_list("module__code", flat=True)
    )
