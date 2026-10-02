from django.db.models import F, Prefetch, Q
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from .models import Membership, MembershipRole, Permission, Role, RolePermission
from .selectors import get_effective_permission_codes
from .system_roles import permission_action


def company_memberships(company):
    return Membership.objects.filter(company=company).select_related("user").prefetch_related(Prefetch(
        "membership_roles", queryset=MembershipRole.objects.filter(role__company=company, role__is_active=True).select_related("role"),
        to_attr="active_assignments",
    )).order_by("pk")


def company_roles(company):
    return Role.objects.filter(company=company, is_active=True).prefetch_related(
        Prefetch("role_permissions", queryset=RolePermission.objects.filter(permission__is_active=True).select_related("permission")),
        Prefetch("membership_roles", queryset=MembershipRole.objects.filter(membership__company=company).select_related("membership")),
    ).order_by("name", "pk")


def membership_by_user(*, company, user_id):
    result = company_memberships(company).filter(user_id=user_id).first()
    if result is None:
        raise NotFound()
    return result


def role_by_id(*, company, role_id):
    result = company_roles(company).filter(pk=role_id).first()
    if result is None:
        raise NotFound()
    return result


def user_payload(membership, *, actor, permissions):
    roles = sorted((link.role for link in membership.active_assignments), key=lambda r: (r.code != "owner", r.pk))
    owner = any(role.is_system and role.code == "owner" for role in roles)
    own = membership.pk == actor.pk
    manage = "users.manage" in permissions
    return {
        "id": membership.user_id, "name": membership.display_name or membership.user.get_full_name() or membership.user.email,
        "email": membership.user.email, "department": membership.department,
        "roleId": roles[0].pk if roles else 0, "roleName": ", ".join(role.name for role in roles) or "User",
        "status": membership.status, "twoFactorEnabled": False,
        "passwordResetRequired": not membership.user.has_usable_password(),
        "lastLogin": membership.user.last_login, "createdAt": membership.created_at,
        "capabilities": dict(canEdit=manage and not owner, canAssignRole=manage and "roles.assign" in permissions and not own and not owner,
                             canSuspend=manage and not own and not owner, canReactivate=manage and not own and not owner),
    }


def role_payload(role, *, permissions):
    return {
        "id": role.pk, "name": role.name, "description": role.description, "system": role.is_system,
        "permissionCodes": sorted(link.permission.code for link in role.role_permissions.all()),
        "version": role.version, "userIds": sorted(link.membership.user_id for link in role.membership_roles.all()),
        "capabilities": dict(canEdit=not role.is_system and "roles.manage" in permissions,
                             canDuplicate=role.code != "owner" and "roles.manage" in permissions,
                             canAssign=role.code != "owner" and "roles.assign" in permissions),
    }


def permission_catalog():
    return [dict(code=p.code, label=p.label, module=p.module, action=permission_action(p.code), grantable=p.is_grantable)
            for p in Permission.objects.filter(is_active=True).order_by("module", "code")]


def admin_metadata(*, company, membership):
    return dict(permissions=get_effective_permission_codes(membership=membership), asOf=timezone.localdate().isoformat())


def filter_memberships(queryset, params):
    if params.get("search"):
        value = params["search"][:150]
        queryset = queryset.filter(Q(display_name__icontains=value) | Q(user__email__icontains=value) | Q(user__first_name__icontains=value) | Q(user__last_name__icontains=value))
    for key in ("status", "department"):
        if params.get(key):
            queryset = queryset.filter(**{key: params[key]})
    if params.get("role"):
        try:
            role_id = int(params["role"])
        except ValueError:
            raise ValidationError({"role": ["Identifiant invalide."]})
        queryset = queryset.filter(membership_roles__role_id=role_id, membership_roles__role__company_id=F("company_id")).distinct()
    ordering = {"name": "display_name", "email": "user__email", "created_at": "created_at", "-created_at": "-created_at"}.get(params.get("ordering"), "pk")
    return queryset.order_by(ordering, "pk")
