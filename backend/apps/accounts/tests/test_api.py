from django.conf import settings
from django.test import TestCase
from django.urls import Resolver404, resolve
from rest_framework.test import APIClient

from apps.accounts.models import Membership, MembershipStatus, RolePermission

from .support import RBACDataMixin


class AuthRBACAPITests(RBACDataMixin, TestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)

    def login(self, **extra_data):
        csrf = self.client.get("/api/auth/csrf/")
        self.assertEqual(csrf.status_code, 200)
        return self.client.post(
            "/api/auth/login/",
            {"email": self.user.email, "password": self.password, **extra_data},
            format="json",
            HTTP_X_CSRFTOKEN=csrf.json()["csrfToken"],
        )

    def assert_auth_payload(self, payload, *, permissions=None, role="Customer reader"):
        if permissions is None:
            permissions = ["customers.view"]
        self.assertEqual(set(payload), {"user", "company"})
        self.assertEqual(payload["user"], {
            "id": self.user.id,
            "name": "RBAC Tester",
            "email": self.user.email,
            "role": role,
            "permissions": permissions,
        })
        self.assertEqual(payload["company"], {
            "id": self.company.id,
            "name": "Company A",
            "onboarding_completed": False,
            "enabled_modules": [],
        })

    def test_login_session_and_me_keep_the_database_rbac_contract(self):
        response = self.login()
        self.assertEqual(response.status_code, 200)
        self.assert_auth_payload(response.json())
        self.assertTrue(response.cookies[settings.SESSION_COOKIE_NAME]["httponly"])
        self.assertEqual(self.client.session["active_company_id"], self.company.id)
        self.assertEqual(self.client.session["active_membership_id"], self.membership.id)

        session = self.client.get("/api/auth/session/")
        self.assertEqual(session.status_code, 200)
        self.assert_auth_payload(session.json())
        profile = self.client.get("/api/me/")
        self.assertEqual(profile.status_code, 200)
        self.assertEqual(profile.json()["id"], self.user.id)
        self.assertEqual(profile.json()["identity"]["email"], self.user.email)
        self.assertEqual(profile.json()["role"], "Customer reader")

    def test_session_permissions_follow_database_grant_changes(self):
        self.assertEqual(self.login().status_code, 200)
        self.grant.delete()
        self.assert_auth_payload(self.client.get("/api/auth/session/").json(), permissions=[])
        RolePermission.objects.create(role=self.role, permission=self.other_permission)
        self.assert_auth_payload(
            self.client.get("/api/auth/session/").json(), permissions=["invoices.view"],
        )

    def test_superuser_payload_does_not_invent_a_role_or_permissions(self):
        self.user.is_superuser = True
        self.user.save(update_fields=["is_superuser"])
        self.assignment.delete()
        response = self.login()
        self.assertEqual(response.status_code, 200)
        self.assert_auth_payload(response.json(), permissions=[], role="User")
        self.assert_auth_payload(
            self.client.get("/api/auth/session/").json(), permissions=[], role="User",
        )
        self.assertEqual(self.client.get("/api/me/").json()["role"], "User")

    def test_client_company_ids_cannot_override_the_session_context(self):
        response = self.login(
            company_id=self.other_company.id,
            membership_id=self.other_membership.id,
        )
        self.assertEqual(response.status_code, 200)
        self.assert_auth_payload(response.json())
        session = self.client.get(
            "/api/auth/session/",
            {"company_id": self.other_company.id},
            HTTP_X_COMPANY_ID=str(self.other_company.id),
        )
        self.assert_auth_payload(session.json())

    def test_login_requires_csrf(self):
        response = self.client.post(
            "/api/auth/login/",
            {"email": self.user.email, "password": self.password},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_logout_requires_csrf_and_invalidates_the_session(self):
        self.assertEqual(self.login().status_code, 200)
        self.assertEqual(self.client.post("/api/auth/logout/").status_code, 403)
        self.assertEqual(self.client.get("/api/auth/session/").status_code, 200)
        response = self.client.post(
            "/api/auth/logout/",
            HTTP_X_CSRFTOKEN=self.client.cookies[settings.CSRF_COOKIE_NAME].value,
        )
        self.assertEqual(response.status_code, 204)
        self.assertEqual(self.client.get("/api/auth/session/").status_code, 401)
        self.assertEqual(self.client.get("/api/me/").status_code, 401)

    def test_login_without_an_active_membership_is_denied(self):
        Membership.objects.filter(user=self.user).update(status=MembershipStatus.SUSPENDED)
        response = self.login()
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "no_active_membership")

    def test_suspended_memberships_invalidate_business_context(self):
        self.assertEqual(self.login().status_code, 200)
        Membership.objects.filter(user=self.user).update(status=MembershipStatus.SUSPENDED)
        for url in ("/api/auth/session/", "/api/me/"):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 403)
                self.assertEqual(response.json()["code"], "no_active_membership")

    def test_inactive_company_cannot_remain_the_session_context(self):
        self.other_membership.delete()
        self.assertEqual(self.login().status_code, 200)
        self.company.is_active = False
        self.company.save(update_fields=["is_active"])
        response = self.client.get("/api/auth/session/")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "no_active_membership")

    def test_temporary_rbac_route_is_not_exposed(self):
        with self.assertRaises(Resolver404):
            resolve("/api/auth/rbac-test/")
