from django.test import TestCase
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.views import APIView

from common.permissions import HasActiveCompany, HasPermission

from .support import RBACDataMixin


class PermissionRequiredView(APIView):
    """Test-only view, deliberately absent from production URL patterns."""

    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]

    def get(self, request):
        return Response({"allowed": True})


class CustomerPermissionView(PermissionRequiredView):
    required_permission = "customers.view"


class HasPermissionTests(RBACDataMixin, TestCase):
    def request(self, view=CustomerPermissionView, *, authenticated=True, context=True):
        request = APIRequestFactory().get("/test-only/")
        if authenticated:
            force_authenticate(request, user=self.user)
        request.membership = self.membership if context else None
        request.company = self.company if context else None
        return view.as_view()(request)

    def test_granted_permission_allows_access(self):
        self.assertEqual(self.request().status_code, 200)

    def test_missing_permission_returns_403(self):
        self.grant.delete()
        self.assertEqual(self.request().status_code, 403)

    def test_undeclared_permission_fails_closed(self):
        self.assertEqual(self.request(PermissionRequiredView).status_code, 403)

    def test_empty_permission_fails_closed(self):
        class EmptyPermissionView(PermissionRequiredView):
            required_permission = ""

        self.assertEqual(self.request(EmptyPermissionView).status_code, 403)

    def test_missing_company_context_is_denied(self):
        self.assertEqual(self.request(context=False).status_code, 403)

    def test_unauthenticated_request_is_denied(self):
        self.assertEqual(self.request(authenticated=False).status_code, 401)

    def test_django_superuser_is_denied_without_a_business_grant(self):
        self.user.is_superuser = True
        self.user.save(update_fields=["is_superuser"])
        self.grant.delete()
        self.assertEqual(self.request().status_code, 403)
