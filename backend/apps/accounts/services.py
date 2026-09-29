from django.contrib.auth import authenticate

from .models import Membership, MembershipStatus


def authenticate_user(*, request, email, password):
    """
    Authenticate a SmartERP user with email and password.
    """

    return authenticate(
        request=request,
        email=email,
        password=password,
    )


def get_default_active_membership(*, user):
    """
    Return the preferred active membership for a user.

    Priority:
    1. default active membership
    2. another active membership
    """

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