from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch
from django.db import connections
from django.test import TransactionTestCase
from apps.accounts.models import User, Membership, Role, MembershipRole, Permission, RolePermission
from apps.companies.models import Company
from apps.intelligence.models import IntelligenceRun
from apps.intelligence.services import request_refresh, claim_run
from apps.intelligence.tasks import run_company_intelligence


class IntelligenceConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.company = Company.objects.create(name="Concurrent intelligence")
        self.user = User.objects.create_user(email="intelligence@example.test")
        self.member = Membership.objects.create(company=self.company, user=self.user)
        role = Role.objects.create(company=self.company, name="Intelligence", code="intelligence")
        MembershipRole.objects.create(membership=self.member, role=role)
        for code in ["ai.use", "invoices.view"]:
            permission, _ = Permission.objects.get_or_create(code=code, defaults=dict(label=code, module=code.split('.')[0], action=code.split('.')[1]))
            RolePermission.objects.create(role=role, permission=permission)

    def race(self, action):
        barrier = Barrier(2)
        def work(_):
            try:
                barrier.wait(timeout=10)
                return action()
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            return list(pool.map(work, range(2)))

    def test_simultaneous_refreshes_and_worker_claims_have_one_owner(self):
        with patch.object(run_company_intelligence, "apply_async") as publish:
            ids = self.race(lambda: request_refresh(company=self.company, membership=self.member, key="concurrent-intelligence").pk)
            self.assertEqual(ids[0], ids[1])
            publish.assert_called_once()
        self.assertEqual(IntelligenceRun.objects.count(), 1)
        claims = self.race(lambda: claim_run(ids[0])[0] is not None)
        self.assertEqual(sorted(claims), [False, True])
