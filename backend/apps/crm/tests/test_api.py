from unittest.mock import patch
from django.test import TestCase
from rest_framework.test import APIClient
from apps.accounts.models import Permission, RolePermission
from apps.accounts.tests.support import RBACDataMixin
from apps.companies.models import DocumentSequence
from apps.crm.models import Customer


class CustomerAPITests(RBACDataMixin, TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_login(self.user)
        for code in ("customers.create", "customers.edit"):
            RolePermission.objects.create(role=self.role, permission=Permission.objects.get(code=code))
        self.payload = dict(name="Client Alpha", type="company", email="client@example.test", phone="", city="Rabat", salesperson="RBAC Tester")
        self.foreign = Customer.objects.create(company=self.other_company, reference="CUS-000001", name="Secret client", email="secret@example.test", city="Fes", type="company")

    def create(self, **overrides):
        return self.client.post("/api/customers/", {**self.payload, **overrides}, format="json")

    def test_authenticated_create_read_update_and_real_empty_360(self):
        created = self.create()
        self.assertEqual(created.status_code, 201, created.data)
        cid = created.data["id"]
        self.assertEqual(created.data["reference"], "CUS-000001")
        detail = self.client.get(f"/api/customers/{cid}/")
        self.assertEqual(detail.status_code, 200)
        for field in ("sales", "invoices", "payments", "documents", "notes"):
            self.assertEqual(detail.data[field], [])
        changed = self.client.patch(f"/api/customers/{cid}/", {"name": "Updated", "tags": ["VIP", "VIP"], "status": "archived"}, format="json")
        self.assertEqual(changed.status_code, 200)
        self.assertEqual(changed.data["tags"], ["VIP"])
        self.assertEqual(changed.data["previousStatus"], "prospect")
        summary = self.client.get(f"/api/customers/{cid}/summary/")
        self.assertEqual(summary.data["revenue"], 0)
        self.assertIsNone(summary.data["paymentReliability"])
        activity = self.client.get(f"/api/customers/{cid}/activity/")
        self.assertEqual(len(activity.data), 1)
        self.assertEqual(activity.data[0]["record"], "CUS-000001")

    def test_foreign_resources_return_404_and_payload_cannot_choose_company(self):
        for suffix in ("", "summary/", "activity/"):
            self.assertEqual(self.client.get(f"/api/customers/{self.foreign.pk}/{suffix}").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/customers/{self.foreign.pk}/", {"name": "Hacked"}, format="json").status_code, 404)
        self.assertEqual(self.create(company_id=self.other_company.pk).status_code, 403)
        result = self.client.get(f"/api/customers/?company_id={self.other_company.pk}")
        self.assertEqual(result.data["customers"], [])

    def test_anonymous_and_permission_denied_even_for_superuser(self):
        self.client.logout()
        self.assertEqual(self.client.get("/api/customers/").status_code, 401)
        self.client.force_login(self.user)
        self.user.is_superuser = True
        self.user.save()
        RolePermission.objects.filter(role=self.role).delete()
        self.assertEqual(self.client.get("/api/customers/").status_code, 403)
        self.assertEqual(self.create().status_code, 403)

    def test_validation_unknown_salesperson_and_read_only_totals(self):
        for changes in (dict(name=""), dict(email="bad"), dict(salesperson="Other tenant salesman"), dict(revenue=900), dict(status="invented")):
            self.assertEqual(self.create(**changes).status_code, 400)
        self.assertFalse(Customer.objects.filter(company=self.company).exists())
        self.assertFalse(DocumentSequence.objects.filter(company=self.company).exists())

    def test_search_status_ordering_and_bounded_pagination(self):
        self.create(name="Zulu")
        self.create(name="Alpha", city="Fes", status="active")
        self.create(name="Beta")
        result = self.client.get("/api/customers/?page_size=1&ordering=name")
        self.assertEqual(result.data["count"], 3)
        self.assertEqual(result.data["customers"][0]["name"], "Alpha")
        self.assertIsNotNone(result.data["next"])
        filtered = self.client.get("/api/customers/?search=Alpha&status=active&city=Fes&salesperson=RBAC%20Tester")
        self.assertEqual(filtered.data["count"], 1)
        self.assertEqual(self.client.get("/api/customers/?outstanding=true").data["count"], 0)
        self.assertEqual(self.client.get("/api/customers/?status=invalid").status_code, 400)

    def test_transaction_failure_rolls_back_customer_and_number(self):
        with patch.object(Customer, "save", side_effect=RuntimeError("late failure")):
            with self.assertRaises(RuntimeError):
                self.create()
        self.assertFalse(DocumentSequence.objects.filter(company=self.company).exists())
        self.assertEqual(self.create().data["reference"], "CUS-000001")

    def test_company_sequences_are_independent_and_monotonic(self):
        self.assertEqual(self.create().data["reference"], "CUS-000001")
        self.assertEqual(self.create().data["reference"], "CUS-000002")
        self.assertEqual(Customer.objects.get(pk=self.foreign.pk).reference, "CUS-000001")
