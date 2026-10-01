from apps.accounts.models import (
    Membership,
    MembershipRole,
    Permission,
    Role,
    RolePermission,
    User,
)
from apps.companies.models import Company


class RBACDataMixin:
    """Company-scoped grants in the isolated Django test database."""

    password = "RBAC-test-password-123!"

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.company = Company.objects.create(name="Company A")
        cls.other_company = Company.objects.create(name="Company B")
        cls.user = User.objects.create_user(
            email="rbac@example.test",
            password=cls.password,
            first_name="RBAC",
            last_name="Tester",
        )
        cls.membership = Membership.objects.create(
            user=cls.user, company=cls.company, is_default=True,
        )
        cls.other_membership = Membership.objects.create(
            user=cls.user, company=cls.other_company,
        )
        cls.role = Role.objects.create(
            company=cls.company, code="reader", name="Customer reader",
        )
        cls.other_role = Role.objects.create(
            company=cls.other_company, code="reader", name="Invoice reader",
        )
        cls.permission = Permission.objects.get(code="customers.view")
        cls.other_permission = Permission.objects.get(code="invoices.view")
        cls.grant = RolePermission.objects.create(
            role=cls.role, permission=cls.permission,
        )
        RolePermission.objects.create(
            role=cls.other_role, permission=cls.other_permission,
        )
        cls.assignment = MembershipRole.objects.create(
            membership=cls.membership, role=cls.role,
        )
        MembershipRole.objects.create(
            membership=cls.other_membership, role=cls.other_role,
        )
