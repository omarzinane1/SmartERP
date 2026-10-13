from django.db import connection
from django.test import TestCase
from apps.accounts.models import MembershipRole, Permission, Role, RolePermission
from apps.notifications.selectors import recipient_memberships
from common.tests.async_support import AsyncDataMixin


class RecipientPermissionTests(AsyncDataMixin, TestCase):
    def test_large_permission_catalog_does_not_multiply_recipient_rows(self):
        # Regression: four joins across a broad role could stall a server-side
        # cursor for minutes even with just one matching recipient.
        existing = set(self.role.role_permissions.values_list("permission_id", flat=True))
        RolePermission.objects.bulk_create([RolePermission(role=self.role, permission=p) for p in Permission.objects.exclude(pk__in=existing)])
        required = ["approvals.view", "approvals.approve", "expenses.view", "expenses.approve"]
        with connection.cursor() as cursor:
            cursor.execute("SET LOCAL statement_timeout = '5s'")
        members = list(recipient_memberships(self.company, required).iterator(chunk_size=100))
        self.assertEqual([m.pk for m in members], [self.membership.pk])
        self.assertNotIn(self.other_membership.pk, [m.pk for m in members])

    def test_permissions_can_be_distributed_across_active_roles_without_duplicates(self):
        needed = ["ai.use", "expenses.view"]
        RolePermission.objects.filter(role=self.role, permission__code__in=needed).delete()
        first = Role.objects.create(company=self.company, code="analytics-a", name="A")
        second = Role.objects.create(company=self.company, code="analytics-b", name="B", is_active=False)
        for role, code in zip([first, second], needed):
            MembershipRole.objects.create(membership=self.membership, role=role)
            RolePermission.objects.create(role=role, permission=Permission.objects.get(code=code))
        self.assertFalse(recipient_memberships(self.company, needed).exists())
        second.is_active = True
        second.save(update_fields=["is_active"])
        RolePermission.objects.create(role=second, permission=Permission.objects.get(code=needed[0]))
        self.assertEqual(list(recipient_memberships(self.company, needed).values_list("pk", flat=True)), [self.membership.pk])
        self.membership.status = "inactive"
        self.membership.save(update_fields=["status"])
        self.assertFalse(recipient_memberships(self.company, needed).exists())
