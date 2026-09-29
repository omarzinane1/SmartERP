from django.contrib.auth import login
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import LoginSerializer
from .services import (
    authenticate_user,
    get_default_active_membership,
)


class CSRFTokenView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        token = get_token(request)

        return Response(
            {
                "csrfToken": token,
            }
        )


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]

        user = authenticate_user(
            request=request,
            email=email,
            password=password,
        )

        if user is None:
            return Response(
                {
                    "detail": "Email ou mot de passe incorrect.",
                    "code": "invalid_credentials",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        membership = get_default_active_membership(
            user=user,
        )

        if membership is None:
            return Response(
                {
                    "detail": (
                        "Aucune société active n'est associée "
                        "à cet utilisateur."
                    ),
                    "code": "no_active_membership",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        login(request, user)

        request.session["active_company_id"] = membership.company_id
        request.session["active_membership_id"] = membership.id

        company = membership.company

        full_name = user.get_full_name().strip()

        return Response(
            {
                "user": {
                "id": user.id,
                "name": full_name or user.email,
                "email": user.email,
                "role": "Admin" if user.is_superuser else "User",
                "permissions": [],
                },
                
                "company": {
                    "id": company.id,
                    "name": company.name,
                    "onboarding_completed": (
                        company.onboarding_completed
                    ),

                    # CompanyModule sera créé plus tard.
                    "enabled_modules": [],
                },
            },
            status=status.HTTP_200_OK,
        )