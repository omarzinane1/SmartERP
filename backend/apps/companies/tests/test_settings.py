from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient
from apps.accounts.models import Permission, RolePermission
from apps.accounts.tests.support import RBACDataMixin
from apps.companies.models import Company, CompanyGeneralSetting, CompanyModule, ModuleDefinition
from apps.companies.selectors import get_enabled_module_codes


class SettingsTests(RBACDataMixin, TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_login(self.user)
        for code in ("settings.view", "settings.manage"):
            RolePermission.objects.create(role=self.role, permission=Permission.objects.get(code=code))

    def change(self, section, values, version=1):
        return self.client.patch(f"/api/settings/{section}/", {"values": values, "version": version}, format="json")

    def test_read_uses_frontend_contract_and_real_company(self):
        response = self.client.get("/api/settings/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["values"]["company"]["companyName"], "Company A")
        self.assertFalse(response.data["policies"]["ai"]["canManage"])
        self.assertEqual(response.data["values"]["integrations"]["items"], [])
        self.assertEqual(CompanyGeneralSetting.objects.count(), 0)

    def test_company_and_general_patch_are_normalized_and_versioned(self):
        response = self.change("company", {"companyName": "New name", "country": "ma"})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["version"], 2)
        self.company.refresh_from_db()
        self.other_company.refresh_from_db()
        self.assertEqual(self.company.name, "New name")
        self.assertEqual(self.other_company.name, "Company B")
        self.assertEqual(self.change("general", {"language": "ar", "timezone": "UTC"}, 2).status_code, 200)
        self.assertEqual(CompanyGeneralSetting.objects.get(company=self.company).language, "ar")

    def test_stale_version_conflicts(self):
        self.assertEqual(self.change("company", {"city": "Rabat"}).status_code, 200)
        self.assertEqual(self.change("company", {"city": "Fes"}).status_code, 409)

    def test_locked_unsupported_invalid_and_foreign_payloads_are_refused(self):
        for section, values, status in [
            ("general", {"currency": "EUR"}, 403), ("ai", {"allowAnalysis": True}, 403),
            ("taxes", {"vatRate": 101}, 400), ("general", {"timezone": "invented"}, 400),
            ("company", {"company_id": self.other_company.pk}, 403), ("unknown", {}, 404),
        ]:
            with self.subTest(section=section, values=values):
                self.assertEqual(self.change(section, values).status_code, status)

    def test_anonymous_and_missing_permissions(self):
        self.client.logout()
        self.assertEqual(self.client.get("/api/settings/").status_code, 401)
        self.client.force_login(self.user)
        RolePermission.objects.filter(role=self.role).delete()
        self.assertEqual(self.client.get("/api/settings/").status_code, 403)
        self.assertEqual(self.change("company", {"city": "Rabat"}).status_code, 403)

    def test_failed_save_rolls_back_normalized_settings(self):
        with patch.object(Company, "save", side_effect=RuntimeError("late failure")):
            with self.assertRaises(RuntimeError):
                self.change("general", {"language": "ar"})
        self.assertFalse(CompanyGeneralSetting.objects.filter(company=self.company).exists())

    def test_modules_require_both_active_definition_and_company_assignment(self):
        module = ModuleDefinition.objects.get(code="customers")
        CompanyModule.objects.create(company=self.other_company, module=module)
        self.assertEqual(get_enabled_module_codes(company=self.company), [])
        link = CompanyModule.objects.create(company=self.company, module=module)
        self.assertEqual(get_enabled_module_codes(company=self.company), ["customers"])
        module.is_active = False
        module.save()
        self.assertEqual(get_enabled_module_codes(company=self.company), [])
        module.is_active = True
        module.save()
        link.is_active = False
        link.save()
        self.assertEqual(get_enabled_module_codes(company=self.company), [])
