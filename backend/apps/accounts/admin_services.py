from uuid import uuid4

from django.db import IntegrityError, transaction
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.companies.models import Company
from common.exceptions import BusinessConflict
from .models import Membership, MembershipRole, Permission, Role, RolePermission, User
from .services import assign_role_to_membership, assert_owner_retained, require_actor, scoped_role
from .system_roles import SYSTEM_ROLES


@transaction.atomic
def save_company_user(*, company, actor, data, user_id=None, invite=False):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=actor, permission_code="users.manage")
    if user_id is not None:
        membership = Membership.objects.select_for_update().filter(company=company, user_id=user_id).first()
        if membership is None:
            raise NotFound()
        user = membership.user
        if "email" in data and data["email"].lower() != user.email.lower():
            raise ValidationError({"email": ["L'identité globale ne peut pas être modifiée depuis cette société."]})
    else:
        # Lock an existing global identity, but never change its credentials or
        # profile from a company administrator's request.
        user = User.objects.select_for_update().filter(email__iexact=data["email"]).first()
        if user is None:
            try:
                with transaction.atomic():
                    user = User.objects.create_user(email=data["email"])
            except IntegrityError:
                user = User.objects.select_for_update().get(email__iexact=data["email"])
        if Membership.objects.filter(company=company, user=user).exists():
            raise BusinessConflict("Un accès existe déjà pour cette adresse dans cette société.")
        membership = Membership.objects.create(company=company, user=user, status="invited" if invite else data.get("status", "active"))
    if user_id is not None and MembershipRole.objects.filter(membership=membership, role__company=company, role__code="owner", role__is_system=True).exists():
        if data.get("status", membership.status) != "active":
            assert_owner_retained(company=company, membership=membership)
        raise PermissionDenied("Le compte Owner est protégé.")
    new_status = "invited" if invite else data.get("status", membership.status)
    if membership.pk == actor.pk and new_status != membership.status:
        raise PermissionDenied("Votre propre accès ne peut pas être suspendu.")
    role_id = data.get("role_id")
    if role_id is not None and not MembershipRole.objects.filter(membership=membership, role_id=role_id, role__company=company).exists():
        role = Role.objects.filter(pk=role_id, company=company).first()
        if role is None:
            raise NotFound()
        assign_role_to_membership(company=company, actor=actor, membership=membership, role=role)
        MembershipRole.objects.filter(membership=membership).exclude(role=role).delete()
    if "name" in data:
        membership.display_name = data["name"]
    if "department" in data:
        membership.department = data["department"]
    membership.status = new_status
    membership.save()
    return membership


@transaction.atomic
def save_custom_role(*, company, actor, data, role_id=None):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=actor, permission_code="roles.manage")
    role = None
    if role_id is not None:
        role = Role.objects.select_for_update().filter(pk=role_id, company=company, is_active=True).first()
        if role is None:
            raise NotFound()
        if role.is_system:
            raise PermissionDenied("Rôle système protégé.")
        if data.get("version") != role.version:
            raise BusinessConflict("Le rôle a changé. Rechargez avant de réessayer.")
    name = data.get("name", role.name if role else "")
    if name.casefold() in {n.casefold() for n in SYSTEM_ROLES.values()}:
        raise ValidationError({"name": ["Nom réservé à un rôle système."]})
    if Role.objects.filter(company=company, name__iexact=name).exclude(pk=role_id).exists():
        raise ValidationError({"name": ["Ce nom de rôle existe déjà."]})
    permissions = None
    if "permission_codes" in data:
        codes = set(data["permission_codes"])
        permissions = list(Permission.objects.select_for_update().filter(code__in=codes, is_active=True, is_grantable=True))
        if len(permissions) != len(codes):
            raise ValidationError({"permission_codes": ["Permission inconnue, inactive ou non attribuable."]})
    if role is None:
        role = Role(company=company, code="custom-" + uuid4().hex)
    else:
        role.version += 1
    role.name = name
    role.description = data.get("description", role.description)
    role.save()
    if permissions is not None:
        # Explicit replacement requested by the editor, unlike system sync.
        RolePermission.objects.filter(role=role).exclude(permission__in=permissions).delete()
        for permission in permissions:
            RolePermission.objects.get_or_create(role=role, permission=permission)
    return role
