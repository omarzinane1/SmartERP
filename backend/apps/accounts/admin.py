from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Membership, User

from .models import User

from .models import (
    Membership,
    MembershipRole,
    Permission,
    Role,
    RolePermission,
    User,
)

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    model = User

    list_display = (
        "email",
        "first_name",
        "last_name",
        "is_staff",
        "is_active",
        "date_joined",
    )

    list_filter = (
        "is_staff",
        "is_active",
        "is_superuser",
    )

    search_fields = (
        "email",
        "first_name",
        "last_name",
    )

    ordering = (
        "email",
    )

    fieldsets = (
        (
            None,
            {
                "fields": (
                    "email",
                    "password",
                )
            },
        ),
        (
            "Informations personnelles",
            {
                "fields": (
                    "first_name",
                    "last_name",
                )
            },
        ),
        (
            "Permissions Django",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        (
            "Dates",
            {
                "fields": (
                    "last_login",
                    "date_joined",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    readonly_fields = (
        "created_at",
        "updated_at",
        "date_joined",
        "last_login",
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": (
                    "wide",
                ),
                "fields": (
                    "email",
                    "password1",
                    "password2",
                    "is_staff",
                    "is_active",
                ),
            },
        ),
    )
    
@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "company",
        "status",
        "is_default",
        "created_at",
    )

    list_filter = (
        "status",
        "is_default",
        "company",
    )

    search_fields = (
        "user__email",
        "company__name",
    )

    autocomplete_fields = (
        "user",
        "company",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "label",
        "module",
        "action",
        "is_active",
        "is_grantable",
    )

    list_filter = (
        "module",
        "is_active",
        "is_grantable",
    )

    search_fields = (
        "code",
        "label",
    )


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "code",
        "company",
        "is_system",
        "is_active",
        "version",
    )

    list_filter = (
        "company",
        "is_system",
        "is_active",
    )

    search_fields = (
        "name",
        "code",
    )

    autocomplete_fields = (
        "company",
    )


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = (
        "role",
        "permission",
        "created_at",
    )

    autocomplete_fields = (
        "role",
        "permission",
    )


@admin.register(MembershipRole)
class MembershipRoleAdmin(admin.ModelAdmin):
    list_display = (
        "membership",
        "role",
        "created_at",
    )

    autocomplete_fields = (
        "membership",
        "role",
    )