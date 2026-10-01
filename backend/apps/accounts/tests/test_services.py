from django.test import TestCase

from apps.accounts.services import can, can_all, can_any

from .support import RBACDataMixin


class AuthorizationHelperTests(RBACDataMixin, TestCase):
    def test_can_requires_a_membership_and_an_assigned_nonempty_permission(self):
        cases = [
            (self.membership, "customers.view", True),
            (self.membership, "customers.delete", False),
            (None, "customers.view", False),
            (self.membership, "", False),
            (self.membership, None, False),
        ]
        for membership, code, expected in cases:
            with self.subTest(membership=membership, code=code):
                self.assertIs(can(membership=membership, permission_code=code), expected)

    def test_can_any_accepts_one_granted_permission(self):
        self.assertTrue(can_any(
            membership=self.membership,
            permission_codes=["customers.view", "customers.delete"],
        ))
        self.assertFalse(can_any(
            membership=self.membership,
            permission_codes=["customers.delete", "invoices.view"],
        ))

    def test_can_all_requires_every_permission(self):
        self.assertFalse(can_all(
            membership=self.membership,
            permission_codes=["customers.view", "customers.delete"],
        ))
        self.assertTrue(can_all(
            membership=self.membership, permission_codes=["customers.view"],
        ))

    def test_multi_permission_helpers_fail_closed_without_inputs(self):
        for helper in (can_any, can_all):
            for membership, codes in (
                (None, ["customers.view"]),
                (self.membership, []),
                (self.membership, ["", None]),
            ):
                with self.subTest(helper=helper.__name__, codes=codes):
                    self.assertFalse(helper(membership=membership, permission_codes=codes))

    def test_django_superuser_still_needs_explicit_grants(self):
        self.user.is_superuser = True
        self.user.save(update_fields=["is_superuser"])
        self.assignment.delete()
        self.assertFalse(can(membership=self.membership, permission_code="customers.view"))
        for helper in (can_any, can_all):
            with self.subTest(helper=helper.__name__):
                self.assertFalse(helper(
                    membership=self.membership, permission_codes=["customers.view"],
                ))
