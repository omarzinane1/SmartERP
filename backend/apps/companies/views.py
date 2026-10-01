from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.services import build_auth_payload
from common.permissions import HasActiveCompany
from .serializers import OnboardingSerializer
from .services import complete_onboarding


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
