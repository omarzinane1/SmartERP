from django.contrib import admin

from .models import Company


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "legal_name",
        "currency",
        "onboarding_completed",
        "is_active",
        "created_at",
    )

    list_filter = (
        "is_active",
        "onboarding_completed",
        "currency",
    )

    search_fields = (
        "name",
        "legal_name",
        "tax_id",
    )

    ordering = (
        "name",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )