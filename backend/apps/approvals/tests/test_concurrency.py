from decimal import Decimal
from django.test import TransactionTestCase
from django.utils import timezone
from apps.finance.tests import test_concurrency as ledger
from apps.accounts.models import RolePermission, Permission
from apps.finance.expense_services import create_expense, submit_expense
from apps.finance.models import Expense
from apps.approvals.models import ApprovalRequest
from apps.approvals.services import decide_request


class ApprovalConcurrencyTests(TransactionTestCase):
    race = ledger.LedgerConcurrencyTests.race

    def setUp(self):
        ledger.LedgerConcurrencyTests.setUp(self)
        role = self.membership.membership_roles.first().role
        for code in ("expenses.create", "expenses.approve", "approvals.approve"):
            permission, _ = Permission.objects.get_or_create(code=code, defaults=dict(label=code, module=code.split('.')[0], action=code.split('.')[1]))
            RolePermission.objects.create(role=role, permission=permission)
        expense = create_expense(company=self.company, membership=self.membership, key="concurrent-expense", data=dict(date=timezone.localdate(), description="Concurrent expense", category="Services", supplier_id=None, employee="Employé", amount_ht=Decimal("10.00"), tax_rate=Decimal("20.00"), note=""))
        submit_expense(company=self.company, membership=self.membership, expense_id=expense.pk)
        self.request = ApprovalRequest.objects.get(expense=expense)

    def test_competing_approve_reject_only_one_decision(self):
        statuses = self.race(lambda i: decide_request(company=self.company, membership=self.membership, request_id=self.request.pk,
            action="approve" if i == 0 else "reject", data=dict(version=1, comment="Décision concurrente")))
        self.assertEqual(statuses, [200, 409])
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, Expense.objects.get(pk=self.request.expense_id).status)
        self.assertEqual(self.request.version, 2)
