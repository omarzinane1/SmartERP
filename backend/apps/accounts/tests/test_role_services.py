from unittest.mock import patch

from django.test import TestCase
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.accounts.models import Membership, MembershipRole, Permission, Role, RolePermission, User
from apps.accounts.selectors import get_effective_permission_codes, membership_has_permission
from apps.accounts.services import (
    assign_role_to_membership, ensure_system_roles, grant_permission_to_role,
    remove_role_from_membership, revoke_permission_from_role, sync_system_role_permissions,
)
from apps.accounts.system_roles import ROLE_CATALOG, SYSTEM_ROLES, system_permission_codes
from common.exceptions import BusinessConflict
from .support import RBACDataMixin


class RoleServiceTests(RBACDataMixin, TestCase):
    def setUp(self):
        for code in ("roles.assign", "roles.manage"):
            RolePermission.objects.create(role=self.role, permission=Permission.objects.get(code=code))
        self.target = Membership.objects.create(
            company=self.company, user=User.objects.create_user(email="target@example.test"),
        )
        self.kwargs = {"company": self.company, "actor": self.membership}

    def test_system_roles_are_company_scoped_idempotent_and_preserve_existing_grants(self):
        roles = sync_system_role_permissions(company=self.company)
        ids = {code: role.pk for code, role in roles.items()}
        extra = Permission.objects.get(code="customers.create")
        RolePermission.objects.create(role=roles["commercial"], permission=extra)
        repeated = sync_system_role_permissions(company=self.company)
        self.assertEqual(ids, {code: role.pk for code, role in repeated.items()})
        self.assertEqual(set(roles), set(SYSTEM_ROLES))
        self.assertEqual(RolePermission.objects.filter(role=roles["owner"]).count(), 61)
        self.assertEqual(len(ROLE_CATALOG), 61)
        for code, role in roles.items():
            self.assertTrue(role.is_system and role.is_active)
            actual = set(role.role_permissions.values_list("permission__code", flat=True))
            self.assertTrue(system_permission_codes(code) <= actual)
        self.assertTrue(RolePermission.objects.filter(role=roles["commercial"], permission=extra).exists())
        others = ensure_system_roles(company=self.other_company)
        self.assertTrue(set(ids.values()).isdisjoint(r.pk for r in others.values()))

    def test_custom_reserved_code_is_not_hijacked_and_operation_rolls_back(self):
        Role.objects.create(company=self.company, code="manager", name="My custom manager")
        with self.assertRaises(BusinessConflict):
            ensure_system_roles(company=self.company)
        self.assertFalse(Role.objects.filter(company=self.company, code="owner").exists())

    def test_assignment_and_removal_are_idempotent(self):
        first = assign_role_to_membership(**self.kwargs, membership=self.target, role=self.role)
        again = assign_role_to_membership(**self.kwargs, membership=self.target, role=self.role)
        self.assertEqual(first.pk, again.pk)
        for _ in range(2):
            remove_role_from_membership(**self.kwargs, membership=self.target, role=self.role)
        self.assertFalse(MembershipRole.objects.filter(membership=self.target).exists())

    def test_foreign_role_or_membership_returns_not_found(self):
        for membership, role in [(self.target, self.other_role), (self.other_membership, self.role)]:
            for service in (assign_role_to_membership, remove_role_from_membership):
                with self.assertRaises(NotFound):
                    service(**self.kwargs, membership=membership, role=role)
        with self.assertRaises(NotFound):
            grant_permission_to_role(**self.kwargs, role=self.other_role, permission=self.permission)

    def test_inactive_role_and_self_assignment_are_denied(self):
        with self.assertRaises(PermissionDenied):
            assign_role_to_membership(**self.kwargs, membership=self.membership, role=self.role)
        self.role.is_active = False
        self.role.save()
        with self.assertRaises(PermissionDenied):
            assign_role_to_membership(**self.kwargs, membership=self.target, role=self.role)

    def test_custom_grant_revoke_and_non_grantable_permissions(self):
        permission = Permission.objects.get(code="quotes.view")
        grant = grant_permission_to_role(**self.kwargs, role=self.role, permission=permission)
        self.assertEqual(grant.pk, grant_permission_to_role(**self.kwargs, role=self.role, permission=permission).pk)
        revoke_permission_from_role(**self.kwargs, role=self.role, permission=permission)
        self.assertFalse(RolePermission.objects.filter(pk=grant.pk).exists())
        for code in ("users.manage", "roles.manage", "roles.assign", "audit.export"):
            with self.assertRaises(ValidationError):
                grant_permission_to_role(**self.kwargs, role=self.role, permission=Permission.objects.get(code=code))

    def test_system_roles_and_owner_are_protected(self):
        roles = sync_system_role_permissions(company=self.company)
        for service in (grant_permission_to_role, revoke_permission_from_role):
            with self.assertRaises(PermissionDenied):
                service(**self.kwargs, role=roles["admin"], permission=self.permission)
        with self.assertRaises(PermissionDenied):
            assign_role_to_membership(**self.kwargs, membership=self.target, role=roles["owner"])
        MembershipRole.objects.create(membership=self.target, role=roles["owner"])
        with self.assertRaises(BusinessConflict):
            remove_role_from_membership(**self.kwargs, membership=self.target, role=roles["owner"])

    def test_missing_business_permission_is_denied_even_for_superuser(self):
        self.user.is_superuser = True
        self.user.save()
        RolePermission.objects.filter(role=self.role, permission__code="roles.assign").delete()
        with self.assertRaises(PermissionDenied):
            assign_role_to_membership(**self.kwargs, membership=self.target, role=self.role)

    def test_system_sync_is_atomic(self):
        with patch("apps.accounts.services.RolePermission.objects.get_or_create", side_effect=RuntimeError("failure")):
            with self.assertRaises(RuntimeError):
                sync_system_role_permissions(company=self.company)
        self.assertFalse(Role.objects.filter(company=self.company, is_system=True).exists())

    def test_missing_or_inactive_membership_has_no_effective_permissions(self):
        self.assertEqual(get_effective_permission_codes(membership=None), [])
        self.membership.status = "suspended"
        self.membership.save()
        self.assertEqual(get_effective_permission_codes(membership=self.membership), [])
        self.assertFalse(membership_has_permission(membership=self.membership, permission_code="customers.view"))
