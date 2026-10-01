from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Membership, MembershipStatus
from apps.accounts.tests.support import RBACDataMixin
from apps.companies.models import (
    CompanyBusinessProfile, CompanyFinanceSetting, CompanyInvoicingSetting,
    CompanyModule, ModuleDefinition,
)
from apps.inventory.models import CompanyInventorySetting, Warehouse
from .support import onboarding_payload


class OnboardingAPITests(RBACDataMixin, TestCase):
    url = "/api/company/onboarding/"

    def setUp(self):
        self.client = APIClient()
        self.client.force_login(self.user)

    def submit(self, payload=None, **headers):
        return self.client.post(
            self.url, payload if payload is not None else onboarding_payload(),
            format="json", **headers,
        )

    def assert_no_configuration(self):
        self.company.refresh_from_db()
        self.assertFalse(self.company.onboarding_completed)
        self.assertEqual(self.company.name, "Company A")
        for model in (CompanyBusinessProfile, CompanyFinanceSetting, CompanyInvoicingSetting,
                      CompanyInventorySetting, CompanyModule, Warehouse):
            self.assertFalse(model.objects.filter(company=self.company).exists(), model.__name__)

    def test_valid_onboarding_persists_every_section_and_marks_complete(self):
        response = self.submit()
        self.assertEqual(response.status_code, 200, response.data)
        self.company.refresh_from_db()
        self.assertTrue(self.company.onboarding_completed)
        self.assertEqual(self.company.name, "Configured A")
        self.assertEqual(self.company.email, "contact@example.test")
        self.assertEqual(self.company.business_profile.business_type, "products")
        self.assertEqual(self.company.finance_setting.vat_rate, 20)
        self.assertEqual(self.company.invoicing_setting.invoice_prefix, "INV-")
        self.assertTrue(self.company.inventory_setting.enabled)
        self.assertEqual(self.company.warehouses.get().code, "MAIN")
        self.assertEqual(response.data["company"]["enabled_modules"],
                         ["customers", "inventory", "sales", "warehouses"])
        self.assertEqual(response.data["user"]["permissions"], ["customers.view"])

    def test_unauthenticated_is_401(self):
        self.client.logout()
        self.assertEqual(self.submit().status_code, 401)
        self.assert_no_configuration()

    def test_missing_company_context_is_403(self):
        Membership.objects.filter(user=self.user).delete()
        self.assertEqual(self.submit().status_code, 403)
        self.assert_no_configuration()

    def test_inactive_company_is_403(self):
        self.other_membership.delete()
        self.company.is_active = False
        self.company.save(update_fields=["is_active"])
        self.assertEqual(self.submit().status_code, 403)
        self.assert_no_configuration()

    def test_inactive_membership_is_403(self):
        Membership.objects.filter(user=self.user).update(status=MembershipStatus.SUSPENDED)
        self.assertEqual(self.submit().status_code, 403)
        self.assert_no_configuration()

    def test_invalid_fields_produce_structured_400_without_writes(self):
        cases = [
            ("company", "name", " "),
            ("company", "email", "invalid"),
            ("company", "currency", "ZZZ"),
            ("company", "currency", "EUR"),
            ("company", "logo", "https://external.example/image.png"),
            ("company", "logo", "data:image/png;base64,bm90LWFuLWltYWdl"),
            ("business", "employee_count", -1),
            ("business", "employee_count", 1.5),
            ("business", "business_type", "invalid"),
            ("finance", "vat_rate", 101),
            ("finance", "vat_rate", -1),
            ("finance", "vat_rate", "invalid"),
            ("finance", "fiscal_year_start", "not-a-date"),
            ("finance", "fiscal_year_end", "2025-01-01"),
            ("invoicing", "invoice_start", 0),
            ("invoicing", "quote_start", 1000000000),
            ("invoicing", "invoice_prefix", "INV /"),
            ("invoicing", "quote_prefix", ""),
            ("inventory", "warehouse_name", ""),
            ("inventory", "warehouse_code", "../OTHER"),
        ]
        for section, field, value in cases:
            with self.subTest(section=section, field=field, value=value):
                payload = onboarding_payload()
                payload[section][field] = value
                response = self.submit(payload)
                self.assertEqual(response.status_code, 400, response.data)
                self.assertIn(section, response.data)
                self.assert_no_configuration()

    def test_optional_fields_and_null_employee_count_are_supported(self):
        payload = onboarding_payload(inventory=False)
        for field in ("logo", "phone", "tax_id", "website", "postal_code"):
            payload["company"].pop(field)
        payload["business"].pop("description")
        self.assertEqual(self.submit(payload).status_code, 200)
        self.company.refresh_from_db()
        self.assertIsNone(self.company.business_profile.employee_count)

    def test_inventory_disabled_creates_no_warehouse(self):
        self.assertEqual(self.submit(onboarding_payload(inventory=False)).status_code, 200)
        self.assertFalse(Warehouse.objects.filter(company=self.company).exists())
        self.assertFalse(CompanyInventorySetting.objects.get(company=self.company).enabled)

    def test_duplicate_warehouse_code_is_400_and_does_not_overwrite(self):
        warehouse = Warehouse.objects.create(company=self.company, code="MAIN", name="Existing")
        response = self.submit()
        self.assertEqual(response.status_code, 400)
        self.assertIn("warehouse_code", response.data["inventory"])
        warehouse.refresh_from_db()
        self.assertEqual(warehouse.name, "Existing")
        self.company.refresh_from_db()
        self.assertFalse(self.company.onboarding_completed)
        self.assertEqual(self.company.name, "Company A")

    def test_same_warehouse_code_in_another_company_is_allowed(self):
        Warehouse.objects.create(company=self.other_company, code="MAIN", name="Other")
        self.assertEqual(self.submit().status_code, 200)
        self.assertEqual(Warehouse.objects.filter(code="MAIN").count(), 2)

    def test_unknown_inactive_duplicate_or_disabled_stock_modules_are_400(self):
        for modules in (["unknown"], ["sales", "sales"], [], ["inventory"]):
            with self.subTest(modules=modules):
                payload = onboarding_payload(inventory=False)
                payload["modules"] = modules
                self.assertEqual(self.submit(payload).status_code, 400)
                self.assert_no_configuration()
        ModuleDefinition.objects.filter(code="sales").update(is_active=False)
        self.assertEqual(self.submit().status_code, 400)
        self.assert_no_configuration()

    def test_double_onboarding_returns_409_without_overwriting(self):
        self.assertEqual(self.submit().status_code, 200)
        payload = onboarding_payload()
        payload["company"]["name"] = "Overwrite attempt"
        self.assertEqual(self.submit(payload).status_code, 409)
        self.company.refresh_from_db()
        self.assertEqual(self.company.name, "Configured A")
        self.assertEqual(Warehouse.objects.filter(company=self.company).count(), 1)

    def test_payload_tenant_override_is_403_and_other_company_is_untouched(self):
        for nested in (False, True):
            with self.subTest(nested=nested):
                payload = onboarding_payload()
                (payload["company"] if nested else payload)["company_id"] = self.other_company.id
                self.assertEqual(self.submit(payload).status_code, 403)
                self.assert_no_configuration()
        self.other_company.refresh_from_db()
        self.assertEqual(self.other_company.name, "Company B")
        self.assertFalse(self.other_company.onboarding_completed)

    def test_query_and_header_company_ids_do_not_select_a_tenant(self):
        response = self.client.post(
            self.url + f"?company_id={self.other_company.id}", onboarding_payload(),
            format="json", HTTP_X_COMPANY_ID=str(self.other_company.id),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["company"]["id"], self.company.id)
        self.other_company.refresh_from_db()
        self.assertFalse(self.other_company.onboarding_completed)
        self.assertFalse(Warehouse.objects.filter(company=self.other_company).exists())

    def test_late_failure_rolls_back_all_sections(self):
        with patch("apps.companies.services.CompanyModule.objects.update_or_create",
                   side_effect=RuntimeError("Injected failure")):
            with self.assertRaisesRegex(RuntimeError, "Injected failure"):
                self.submit()
        self.assert_no_configuration()

    def test_logo_is_persisted_in_the_same_transaction(self):
        payload = onboarding_payload(inventory=False)
        payload["company"]["logo"] = (
            "data:image/png;base64,"
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg=="
        )
        self.assertEqual(self.submit(payload).status_code, 200)
        self.company.refresh_from_db()
        self.assertEqual(self.company.logo_mime_type, "image/png")
        self.assertTrue(bytes(self.company.logo).startswith(b"\x89PNG"))

    def test_auth_csrf_onboarding_session_flow(self):
        client = APIClient(enforce_csrf_checks=True)
        csrf = client.get("/api/auth/csrf/")
        response = client.post("/api/auth/login/", {
            "email": self.user.email, "password": self.password,
        }, format="json", HTTP_X_CSRFTOKEN=csrf.data["csrfToken"])
        self.assertEqual(response.status_code, 200)
        before = client.get("/api/auth/session/")
        self.assertFalse(before.data["company"]["onboarding_completed"])
        self.assertEqual(before.data["company"]["enabled_modules"], [])
        self.assertEqual(client.post(self.url, onboarding_payload(), format="json").status_code, 403)
        csrf = client.get("/api/auth/csrf/")
        response = client.post(self.url, onboarding_payload(), format="json",
                               HTTP_X_CSRFTOKEN=csrf.data["csrfToken"])
        self.assertEqual(response.status_code, 200, response.data)
        after = client.get("/api/auth/session/")
        self.assertTrue(after.data["company"]["onboarding_completed"])
        self.assertEqual(after.data["company"]["enabled_modules"],
                         ["customers", "inventory", "sales", "warehouses"])
        self.assertEqual(after.data["user"]["id"], before.data["user"]["id"])
