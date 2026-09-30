from django.contrib.auth import authenticate

from .models import Membership, MembershipStatus
from django.contrib.auth import authenticate, logout
from django.utils import timezone


def authenticate_user(*, request, email, password):
    return authenticate(
        request=request,
        email=email,
        password=password,
    )


def get_default_active_membership(*, user):
    return (
        Membership.objects
        .select_related("company")
        .filter(
            user=user,
            status=MembershipStatus.ACTIVE,
            company__is_active=True,
        )
        .order_by(
            "-is_default",
            "created_at",
        )
        .first()
    )


def get_session_membership(*, request):
    membership_id = request.session.get(
        "active_membership_id"
    )

    company_id = request.session.get(
        "active_company_id"
    )

    if not membership_id or not company_id:
        return None

    return (
        Membership.objects
        .select_related("company", "user")
        .filter(
            id=membership_id,
            user=request.user,
            company_id=company_id,
            status=MembershipStatus.ACTIVE,
            company__is_active=True,
        )
        .first()
    )


def resolve_active_membership(*, request):
    membership = get_session_membership(
        request=request,
    )

    if membership is not None:
        return membership

    membership = get_default_active_membership(
        user=request.user,
    )

    if membership is None:
        return None

    request.session["active_company_id"] = membership.company_id
    request.session["active_membership_id"] = membership.id

    return membership


def build_auth_payload(*, user, membership):
    company = membership.company

    full_name = user.get_full_name().strip()

    return {
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
            "onboarding_completed": company.onboarding_completed,
            "enabled_modules": [],
        },
    }

def logout_user(*, request):
    """
    Destroy the current Django authentication session.
    """
    logout(request)

def build_profile_payload(*, user, membership):
    """
    Build the current user's profile response.

    Some profile features such as preferences, 2FA,
    activity history and session management will be
    backed by dedicated models later.
    """

    company = membership.company

    full_name = user.get_full_name().strip()

    return {
        "id": user.id,

        "identity": {
            "firstName": user.first_name or "",
            "lastName": user.last_name or "",
            "displayName": full_name or user.email,
            "email": user.email,

            # Dedicated profile fields will be added later.
            "phone": "",
            "jobTitle": "",
        },

        "preferences": {
            # Temporary defaults until UserPreference exists.
            "language": "fr",
            "timezone": company.timezone,
            "theme": "system",
            "dateFormat": "DD/MM/YYYY",
            "numberFormat": "fr-MA",

            "notifications": {
                "email": False,
                "inApp": False,
                "approvals": False,
                "invoiceReminders": False,
                "stockAlerts": False,
                "aiAlerts": False,
            },
        },

        # Temporary until RBAC is implemented.
        "role": "Admin" if user.is_superuser else "User",

        # Department model will be added later.
        "department": "",

        "status": membership.status,

        "avatarUrl": None,

        # MFA will be implemented later.
        "twoFactorEnabled": False,

        # Dedicated session management comes later.
        "sessions": [],

        # Audit/profile activity will come later.
        "activity": [],

        "passwordPolicy": {
            "minLength": None,
            "maxLength": None,
            "requireUppercase": False,
            "requireNumber": False,
            "summary": "Politique de mot de passe gérée par Django.",
        },

        "capabilities": {
            # PATCH /me/ is not implemented yet.
            "canEditProfile": False,
            "canEditEmail": False,

            # These endpoints are not implemented yet.
            "canChangePassword": False,
            "canSetup2FA": False,
            "canDisable2FA": False,
        },

        "options": {
            "languages": [],
            "timezones": [],
            "dateFormats": [],
            "numberFormats": [],
        },

        "asOf": timezone.localdate().isoformat(),
    }