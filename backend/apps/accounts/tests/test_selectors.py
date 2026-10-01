from django.test import TestCase

from apps.accounts.models import MembershipRole, Role, RolePermission
from apps.accounts.selectors import (
    get_effective_permission_codes,
    get_membership_role_display,
    membership_has_permission,
)

from .support import RBACDataMixin


class PermissionSelectorTests(RBACDataMixin, TestCase):
    def test_membership_has_only_assigned_permissions(self):
        self.assertTrue(membership_has_permission(
            membership=self.membership, permission_code="customers.view",
        ))
        self.assertFalse(membership_has_permission(
            membership=self.membership, permission_code="customers.delete",
        ))

    def test_missing_membership_or_empty_code_is_denied(self):
        self.assertFalse(membership_has_permission(
            membership=None, permission_code="customers.view",
        ))
        self.assertFalse(membership_has_permission(
            membership=self.membership, permission_code="",
        ))

    def test_permissions_are_deduplicated_across_roles(self):
        second_role = Role.objects.create(
            company=self.company, code="second-reader", name="Second reader",
        )
        RolePermission.objects.create(role=second_role, permission=self.permission)
        MembershipRole.objects.create(membership=self.membership, role=second_role)
        self.assertEqual(
            get_effective_permission_codes(membership=self.membership),
            ["customers.view"],
        )

    def test_other_company_grants_do_not_leak_even_with_an_invalid_assignment(self):
        # ORM save/bulk operations can bypass model.clean(); selectors must
        # remain company-scoped even if inconsistent data reaches the database.
        MembershipRole.objects.create(
            membership=self.membership, role=self.other_role,
        )
        self.assertEqual(
            get_effective_permission_codes(membership=self.membership),
            ["customers.view"],
        )
        self.assertFalse(membership_has_permission(
            membership=self.membership, permission_code="invoices.view",
        ))
        self.assertEqual(
            get_membership_role_display(membership=self.membership),
            "Customer reader",
        )
        self.assertEqual(
            get_effective_permission_codes(membership=self.other_membership),
            ["invoices.view"],
        )

    def test_inactive_role_grants_nothing(self):
        self.role.is_active = False
        self.role.save(update_fields=["is_active"])
        self.assertEqual(get_effective_permission_codes(membership=self.membership), [])
        self.assertFalse(membership_has_permission(
            membership=self.membership, permission_code="customers.view",
        ))

    def test_inactive_permission_is_excluded(self):
        self.permission.is_active = False
        self.permission.save(update_fields=["is_active"])
        self.assertEqual(get_effective_permission_codes(membership=self.membership), [])
        self.assertFalse(membership_has_permission(
            membership=self.membership, permission_code="customers.view",
        ))

    def test_django_superuser_has_no_business_permission_bypass(self):
        self.user.is_superuser = True
        self.user.save(update_fields=["is_superuser"])
        self.assignment.delete()
        self.assertFalse(membership_has_permission(
            membership=self.membership, permission_code="customers.view",
        ))
        self.assertEqual(get_effective_permission_codes(membership=self.membership), [])
