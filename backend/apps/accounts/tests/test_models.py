from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.accounts.models import MembershipRole, Permission, Role

from .support import RBACDataMixin


class RBACModelTests(RBACDataMixin, TestCase):
    def test_membership_role_validates_same_company(self):
        role = Role.objects.create(company=self.company, code="extra", name="Extra")
        assignment = MembershipRole(membership=self.membership, role=role)
        assignment.full_clean()
        assignment.save()
        self.assertIsNotNone(assignment.pk)

    def test_membership_role_rejects_another_company(self):
        assignment = MembershipRole(membership=self.membership, role=self.other_role)
        with self.assertRaises(ValidationError) as error:
            assignment.full_clean()
        self.assertIn("role", error.exception.message_dict)
        self.assertFalse(MembershipRole.objects.filter(
            membership=self.membership, role=self.other_role,
        ).exists())

    def test_permission_code_is_unique_in_the_database(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Permission.objects.create(
                code="customers.view", label="Duplicate", module="customers", action="view",
            )
