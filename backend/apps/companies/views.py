from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.services import build_auth_payload
from common.permissions import HasActiveCompany, HasPermission
from .serializers import OnboardingSerializer
from .services import complete_onboarding
from .settings_contract import SettingsPatchSerializer
from .settings_selectors import settings_payload
from .settings_services import update_settings


class CompanyOnboardingView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany]

    def post(self, request):
        serializer = OnboardingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company = complete_onboarding(
            company=request.company,
            membership=request.membership,
            data=serializer.validated_data,
        )
        request.membership.company = company
        return Response(build_auth_payload(
            user=request.user, membership=request.membership,
        ))


class CompanySettingsView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]
    required_permission = "settings.view"

    def get(self, request):
        return Response(settings_payload(company=request.company, membership=request.membership))


class CompanySettingsSectionView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]
    required_permission = "settings.manage"

    def patch(self, request, section):
        serializer = SettingsPatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(update_settings(company=request.company, membership=request.membership,
                                        section=section, data=serializer.validated_data))
