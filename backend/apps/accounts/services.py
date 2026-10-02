from django.contrib.auth import authenticate, logout
from django.utils import timezone
from django.db import transaction
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from common.exceptions import BusinessConflict
from apps.companies.models import Company
from apps.companies.selectors import get_enabled_module_codes

from .models import Membership, MembershipStatus, MembershipRole, Permission, Role, RolePermission
from .system_roles import SYSTEM_ROLES, system_permission_codes
from .selectors import (
    get_effective_permission_codes,
    get_membership_role_display,
    membership_has_permission,
)


def authenticate_user(*, request, email, password):
    return authenticate(
        request=request,
        email=email,
        password=password,
    )


def get_default_active_membership(*, user):
    return (
        Membership.objects
        .select_related("company")
        .filter(
            user=user,
            status=MembershipStatus.ACTIVE,
            company__is_active=True,
        )
        .order_by(
            "-is_default",
            "created_at",
        )
        .first()
    )


def get_session_membership(*, request):
    membership_id = request.session.get(
        "active_membership_id"
    )

    company_id = request.session.get(
        "active_company_id"
    )

    if not membership_id or not company_id:
        return None

    return (
        Membership.objects
        .select_related("company", "user")
        .filter(
            id=membership_id,
            user=request.user,
            company_id=company_id,
            status=MembershipStatus.ACTIVE,
            company__is_active=True,
        )
        .first()
    )


def resolve_active_membership(*, request):
    membership = get_session_membership(
        request=request,
    )

    if membership is not None:
        return membership

    membership = get_default_active_membership(
        user=request.user,
    )

    if membership is None:
        return None

    request.session["active_company_id"] = membership.company_id
    request.session["active_membership_id"] = membership.id

    return membership


def build_auth_payload(*, user, membership):
    company = membership.company

    full_name = user.get_full_name().strip()

    role = get_membership_role_display(
        membership=membership,
    )

    permissions = get_effective_permission_codes(
        membership=membership,
    )

    return {
        "user": {
            "id": user.id,
            "name": full_name or user.email,
            "email": user.email,
            "role": role,
            "permissions": permissions,
        },

        "company": {
            "id": company.id,
            "name": company.name,
            "onboarding_completed": company.onboarding_completed,
            "enabled_modules": get_enabled_module_codes(company=company),
        },
    }

def logout_user(*, request):
    """
    Destroy the current Django authentication session.
    """
    logout(request)

def build_profile_payload(*, user, membership):
    """
    Build the current user's profile response.

    Some profile features such as preferences, 2FA,
    activity history and session management will be
    backed by dedicated models later.
    """

    company = membership.company

    full_name = user.get_full_name().strip()

    role = get_membership_role_display(
        membership=membership,
    )

    return {
        "id": user.id,

        "identity": {
            "firstName": user.first_name or "",
            "lastName": user.last_name or "",
            "displayName": full_name or user.email,
            "email": user.email,

            # Dedicated profile fields will be added later.
            "phone": "",
            "jobTitle": "",
        },

        "preferences": {
            # Temporary defaults until UserPreference exists.
            "language": "fr",
            "timezone": company.timezone,
            "theme": "system",
            "dateFormat": "DD/MM/YYYY",
            "numberFormat": "fr-MA",

            "notifications": {
                "email": False,
                "inApp": False,
                "approvals": False,
                "invoiceReminders": False,
                "stockAlerts": False,
                "aiAlerts": False,
            },
        },

        "role": role,

        # Department model will be added later.
        "department": "",

        "status": membership.status,

        "avatarUrl": None,

        # MFA will be implemented later.
        "twoFactorEnabled": False,

        # Dedicated session management comes later.
        "sessions": [],

        # Audit/profile activity will come later.
        "activity": [],

        "passwordPolicy": {
            "minLength": None,
            "maxLength": None,
            "requireUppercase": False,
            "requireNumber": False,
            "summary": "Politique de mot de passe gérée par Django.",
        },

        "capabilities": {
            # PATCH /me/ is not implemented yet.
            "canEditProfile": False,
            "canEditEmail": False,

            # These endpoints are not implemented yet.
            "canChangePassword": False,
            "canSetup2FA": False,
            "canDisable2FA": False,
        },

        "options": {
            "languages": [],
            "timezones": [],
            "dateFormats": [],
            "numberFormats": [],
        },

        "asOf": timezone.localdate().isoformat(),
    }

def can(*, membership, permission_code):
    """
    Return whether the membership has the requested
    SmartERP permission.

    This is the central authorization helper for
    permission-code checks.
    """

    if membership is None:
        return False

    if not permission_code:
        return False

    return membership_has_permission(
        membership=membership,
        permission_code=permission_code,
    )

def can_any(*, membership, permission_codes):
    """
    Return True if the membership has at least one
    of the requested permissions.
    """

    if membership is None:
        return False

    codes = [
        code
        for code in permission_codes
        if code
    ]

    if not codes:
        return False

    effective_permissions = set(
        get_effective_permission_codes(
            membership=membership,
        )
    )

    return any(
        code in effective_permissions
        for code in codes
    )

def can_all(*, membership, permission_codes):
    """
    Return True only if the membership has all
    requested permissions.
    """

    if membership is None:
        return False

    codes = [
        code
        for code in permission_codes
        if code
    ]

    if not codes:
        return False

    effective_permissions = set(
        get_effective_permission_codes(
            membership=membership,
        )
    )

    return all(
        code in effective_permissions
        for code in codes
    )


@transaction.atomic
def ensure_system_roles(*, company):
    Company.objects.select_for_update().get(pk=company.pk)
    roles = {}
    for code, name in SYSTEM_ROLES.items():
        role, created = Role.objects.get_or_create(
            company=company, code=code,
            defaults={"name": name, "is_system": True, "is_active": True,
                      "description": "Rôle système protégé."},
        )
        if not role.is_system:
            raise BusinessConflict(f"Le code réservé {code} est utilisé par un rôle personnalisé.")
        if not created and (role.name != name or not role.is_active):
            role.name, role.is_active = name, True
            role.save(update_fields=["name", "is_active", "updated_at"])
        roles[code] = role
    return roles


@transaction.atomic
def sync_system_role_permissions(*, company):
    roles = ensure_system_roles(company=company)
    permissions = {p.code: p for p in Permission.objects.filter(is_active=True)}
    for code, role in roles.items():
        for permission_code in sorted(system_permission_codes(code)):
            if permission_code in permissions:
                RolePermission.objects.get_or_create(role=role, permission=permissions[permission_code])
    return roles


def require_actor(*, company, actor, permission_code):
    if actor is None or actor.company_id != company.pk:
        raise PermissionDenied("Aucun contexte de société actif.")
    if not can(membership=actor, permission_code=permission_code):
        raise PermissionDenied("Permission insuffisante.")


def scoped_role(*, company, role, lock=False):
    query = Role.objects.filter(company=company)
    if lock:
        query = query.select_for_update()
    result = query.filter(pk=role.pk).first()
    if result is None:
        raise NotFound()
    return result


def scoped_membership(*, company, membership, lock=False):
    query = Membership.objects.filter(company=company)
    if lock:
        query = query.select_for_update()
    result = query.filter(pk=membership.pk).first()
    if result is None:
        raise NotFound()
    return result


def assert_owner_retained(*, company, membership):
    """Caller holds the Company row lock, serializing all ownership changes."""
    owns = MembershipRole.objects.filter(
        membership=membership, role__company=company, role__code="owner",
        role__is_system=True, role__is_active=True,
    ).exists()
    another_owner = MembershipRole.objects.filter(
        membership__company=company, membership__status=MembershipStatus.ACTIVE,
        membership__user__is_active=True, role__company=company,
        role__code="owner", role__is_system=True, role__is_active=True,
    ).exclude(membership=membership).exists()
    if owns and membership.status == MembershipStatus.ACTIVE and not another_owner:
        raise BusinessConflict("Le dernier Owner actif doit être conservé.")


@transaction.atomic
def assign_role_to_membership(*, company, actor, membership, role):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=actor, permission_code="roles.assign")
    target = scoped_membership(company=company, membership=membership, lock=True)
    target_role = scoped_role(company=company, role=role, lock=True)
    if not target_role.is_active or (target_role.is_system and target_role.code == "owner"):
        raise PermissionDenied("Ce rôle ne peut pas être attribué depuis l'administration.")
    if target.pk == actor.pk:
        raise PermissionDenied("Votre propre rôle ne peut pas être modifié.")
    assignment, _ = MembershipRole.objects.get_or_create(membership=target, role=target_role)
    return assignment


@transaction.atomic
def remove_role_from_membership(*, company, actor, membership, role):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=actor, permission_code="roles.assign")
    target = scoped_membership(company=company, membership=membership, lock=True)
    target_role = scoped_role(company=company, role=role, lock=True)
    if target.pk == actor.pk:
        raise PermissionDenied("Votre propre rôle ne peut pas être modifié.")
    if target_role.is_system and target_role.code == "owner":
        assert_owner_retained(company=company, membership=target)
        raise PermissionDenied("Le rôle Owner est protégé.")
    MembershipRole.objects.filter(membership=target, role=target_role).delete()


@transaction.atomic
def grant_permission_to_role(*, company, actor, role, permission):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=actor, permission_code="roles.manage")
    target = scoped_role(company=company, role=role, lock=True)
    if target.is_system:
        raise PermissionDenied("Rôle système protégé.")
    permission = Permission.objects.select_for_update().get(pk=permission.pk)
    if not permission.is_active or not permission.is_grantable:
        raise ValidationError({"permission_codes": ["Permission non attribuable."]})
    grant, created = RolePermission.objects.get_or_create(role=target, permission=permission)
    if created:
        target.version += 1
        target.save(update_fields=["version", "updated_at"])
    return grant


@transaction.atomic
def revoke_permission_from_role(*, company, actor, role, permission):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=actor, permission_code="roles.manage")
    target = scoped_role(company=company, role=role, lock=True)
    if target.is_system:
        raise PermissionDenied("Rôle système protégé.")
    deleted, _ = RolePermission.objects.filter(role=target, permission=permission).delete()
    if deleted:
        target.version += 1
        target.save(update_fields=["version", "updated_at"])
