from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Membership, MembershipRole, Permission, Role, RolePermission, User
from apps.accounts.services import sync_system_role_permissions
from .support import RBACDataMixin


class AdminAPITests(RBACDataMixin, TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_login(self.user)
        for code in ("users.manage", "roles.assign", "roles.manage"):
            RolePermission.objects.create(role=self.role, permission=Permission.objects.get(code=code))
        self.foreign_user = User.objects.create_user(email="foreign@example.test", first_name="Global")
        self.foreign_member = Membership.objects.create(user=self.foreign_user, company=self.other_company, display_name="Foreign identity")
        self.user_data = dict(name="Test member", email="new@example.test", department="Sales", role_id=self.role.pk)
        self.role_data = dict(name="Quotes reviewer", description="Custom", permission_codes=["quotes.view", "customers.view"])

    def create_user(self, **overrides):
        return self.client.post("/api/admin/users/", {**self.user_data, **overrides}, format="json")

    def test_anonymous_and_missing_permission_access(self):
        self.client.logout()
        for url in ("users", "roles", "permissions"):
            self.assertEqual(self.client.get(f"/api/admin/{url}/").status_code, 401)
        self.client.force_login(self.user)
        RolePermission.objects.filter(role=self.role).delete()
        self.assertEqual(self.client.get("/api/admin/users/").status_code, 403)
        self.assertEqual(self.client.get("/api/admin/roles/").status_code, 403)
        self.assertEqual(self.create_user().status_code, 403)

    def test_user_create_list_detail_update_status_and_pagination(self):
        response = self.create_user()
        self.assertEqual(response.status_code, 201, response.data)
        uid = response.data["id"]
        self.assertTrue(response.data["passwordResetRequired"])
        self.assertEqual(self.client.get(f"/api/admin/users/{uid}/").status_code, 200)
        for status in ("suspended", "disabled", "invited", "active"):
            update = self.client.patch(f"/api/admin/users/{uid}/", {"status": status}, format="json")
            self.assertEqual(update.status_code, 200, update.data)
            self.assertEqual(update.data["status"], status)
        result = self.client.get("/api/admin/users/?page_size=1")
        self.assertEqual(len(result.data["users"]), 1)
        self.assertEqual(result.data["count"], 2)
        self.assertIsNotNone(result.data["next"])
        filtered = self.client.get(f"/api/admin/users/?search=new@&role={self.role.pk}")
        self.assertEqual([u["id"] for u in filtered.data["users"]], [uid])

    def test_invitation_is_recorded_without_sending_or_resetting_credentials(self):
        existing_password = self.foreign_user.password
        response = self.client.post("/api/admin/invitations/", {**self.user_data, "email": self.foreign_user.email}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["status"], "invited")
        self.foreign_user.refresh_from_db()
        self.foreign_member.refresh_from_db()
        self.assertEqual(self.foreign_user.password, existing_password)
        self.assertEqual(self.foreign_user.first_name, "Global")
        self.assertEqual(self.foreign_member.display_name, "Foreign identity")

    def test_foreign_users_roles_and_assignments_are_not_found(self):
        for method in (self.client.get, self.client.patch):
            self.assertEqual(method(f"/api/admin/users/{self.foreign_user.pk}/", {}, format="json").status_code, 404)
            self.assertEqual(method(f"/api/admin/roles/{self.other_role.pk}/", {}, format="json").status_code, 404)
        self.assertEqual(self.create_user(role_id=self.other_role.pk).status_code, 404)
        self.assertFalse(User.objects.filter(email=self.user_data["email"]).exists())
        roles = self.client.get("/api/admin/roles/").data["roles"]
        self.assertNotIn(self.other_role.pk, [r["id"] for r in roles])

    def test_duplicate_email_validation_and_global_identity_protection(self):
        created = self.create_user()
        self.assertEqual(self.create_user().status_code, 409)
        uid = created.data["id"]
        self.assertEqual(self.client.patch(f"/api/admin/users/{uid}/", {"email": "elsewhere@example.test"}, format="json").status_code, 400)
        self.assertEqual(self.create_user(email="invalid").status_code, 400)
        self.assertEqual(self.create_user(company_id=self.other_company.pk).status_code, 403)

    def test_assignment_requires_roles_assign_and_self_access_is_protected(self):
        RolePermission.objects.filter(role=self.role, permission__code="roles.assign").delete()
        self.assertEqual(self.create_user().status_code, 403)
        self.assertFalse(User.objects.filter(email=self.user_data["email"]).exists())
        self.assertEqual(self.client.patch(f"/api/admin/users/{self.user.pk}/", {"status": "disabled"}, format="json").status_code, 403)

    def test_last_owner_cannot_be_disabled_or_replaced(self):
        roles = sync_system_role_permissions(company=self.company)
        owner = Membership.objects.create(company=self.company, user=User.objects.create_user(email="owner@example.test"))
        MembershipRole.objects.create(membership=owner, role=roles["owner"])
        self.assertEqual(self.client.patch(f"/api/admin/users/{owner.user_id}/", {"status": "disabled"}, format="json").status_code, 409)
        self.assertEqual(self.client.patch(f"/api/admin/users/{owner.user_id}/", {"role_id": self.role.pk}, format="json").status_code, 403)
        self.assertEqual(self.create_user(role_id=roles["owner"].pk).status_code, 403)

    def test_custom_role_create_read_update_version_and_frontend_duplication(self):
        response = self.client.post("/api/admin/roles/", self.role_data, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        role_id = response.data["id"]
        self.assertFalse(response.data["system"])
        self.assertEqual(self.client.get(f"/api/admin/roles/{role_id}/").data["permissionCodes"], ["customers.view", "quotes.view"])
        update = self.client.patch(f"/api/admin/roles/{role_id}/", {"permission_codes": ["quotes.edit"], "version": 1}, format="json")
        self.assertEqual(update.status_code, 200, update.data)
        self.assertEqual(update.data["permissionCodes"], ["quotes.edit"])
        self.assertEqual(update.data["version"], 2)
        self.assertEqual(self.client.patch(f"/api/admin/roles/{role_id}/", {"description": "stale", "version": 1}, format="json").status_code, 409)
        copy = self.client.post("/api/admin/roles/", {**self.role_data, "name": "Reviewer copy"}, format="json")
        self.assertEqual(copy.status_code, 201)
        self.assertNotEqual(copy.data["id"], role_id)

    def test_role_non_grantable_unknown_inactive_and_system_permissions(self):
        for code in ("users.manage", "roles.manage", "roles.assign", "audit.export", "invented.view"):
            with self.subTest(code=code):
                result = self.client.post("/api/admin/roles/", {**self.role_data, "permission_codes": [code]}, format="json")
                self.assertEqual(result.status_code, 400)
        permission = Permission.objects.get(code="quotes.view")
        permission.is_active = False
        permission.save()
        self.assertEqual(self.client.post("/api/admin/roles/", self.role_data, format="json").status_code, 400)
        admin = sync_system_role_permissions(company=self.company)["admin"]
        self.assertEqual(self.client.patch(f"/api/admin/roles/{admin.pk}/", {"name": "Changed", "version": 1}, format="json").status_code, 403)
        self.assertEqual(self.client.delete(f"/api/admin/roles/{admin.pk}/").status_code, 405)

    def test_role_writes_are_atomic_and_catalog_contains_82_entries(self):
        with patch("apps.accounts.admin_services.RolePermission.objects.get_or_create", side_effect=RuntimeError("failed")):
            with self.assertRaises(RuntimeError):
                self.client.post("/api/admin/roles/", self.role_data, format="json")
        self.assertFalse(Role.objects.filter(name=self.role_data["name"]).exists())
        catalog = self.client.get("/api/admin/permissions/")
        self.assertEqual(len(catalog.data), 82)
        self.assertEqual(sum(not p["grantable"] for p in catalog.data), 4)
