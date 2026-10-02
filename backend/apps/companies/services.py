from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import Membership, MembershipStatus
from apps.inventory.models import CompanyInventorySetting, Warehouse
from .exceptions import OnboardingAlreadyCompleted
from .models import (
    Company, CompanyBusinessProfile, CompanyFinanceSetting,
    CompanyInvoicingSetting, CompanyModule, ModuleDefinition,
)


@transaction.atomic
def complete_onboarding(*, company, membership, data):
    from apps.accounts.services import sync_system_role_permissions
    # Serializes concurrent onboarding requests for this company.
    company = Company.objects.select_for_update().get(pk=company.pk)
    if not company.is_active or not Membership.objects.filter(
        pk=membership.pk, company=company, user_id=membership.user_id,
        user__is_active=True, status=MembershipStatus.ACTIVE,
    ).exists():
        raise PermissionDenied("Aucun contexte de société actif.")
    if company.onboarding_completed:
        raise OnboardingAlreadyCompleted()
    sync_system_role_permissions(company=company)

    inventory = dict(data["inventory"])
    if inventory["enabled"] and Warehouse.objects.filter(
        company=company, code=inventory["warehouse_code"],
    ).exists():
        raise ValidationError({
            "inventory": {"warehouse_code": ["Ce code de dépôt existe déjà dans cette société."]}
        })
    modules = list(ModuleDefinition.objects.select_for_update().filter(
        code__in=data["modules"], is_active=True,
    ))
    if len(modules) != len(data["modules"]):
        raise ValidationError({"modules": ["Un module demandé n'est plus disponible."]})

    company_data = dict(data["company"])
    company.logo, company.logo_mime_type = company_data.pop("logo")
    for field, value in company_data.items():
        setattr(company, field, value)
    company.save()
    CompanyBusinessProfile.objects.update_or_create(
        company=company, defaults=data["business"],
    )
    finance = dict(data["finance"])
    finance.pop("currency")
    CompanyFinanceSetting.objects.update_or_create(company=company, defaults=finance)
    CompanyInvoicingSetting.objects.update_or_create(
        company=company, defaults=data["invoicing"],
    )

    if inventory["enabled"]:
        Warehouse.objects.create(
            company=company,
            name=inventory.pop("warehouse_name"),
            code=inventory.pop("warehouse_code"),
            address=inventory.pop("warehouse_address"),
        )
    CompanyInventorySetting.objects.update_or_create(company=company, defaults=inventory)

    # Explicit initial selection; preserve existing rows when deselecting.
    CompanyModule.objects.filter(company=company).exclude(
        module__in=modules,
    ).update(is_active=False)
    for module in modules:
        CompanyModule.objects.update_or_create(
            company=company, module=module, defaults={"is_active": True},
        )
    company.onboarding_completed = True
    company.save(update_fields=["onboarding_completed", "updated_at"])
    return company
