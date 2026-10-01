from rest_framework.permissions import BasePermission

from apps.accounts.services import can


class HasActiveCompany(BasePermission):
    """
    Require an authenticated user with an active
    Membership and Company context.
    """

    message = (
        "Aucune société active n'est associée "
        "à cette session."
    )

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        membership = getattr(
            request,
            "membership",
            None,
        )

        company = getattr(
            request,
            "company",
            None,
        )

        return (
            membership is not None
            and company is not None
            and membership.user_id == request.user.pk
            and membership.company_id == company.pk
            and membership.status == "active"
            and company.is_active
            and request.user.is_active
        )


class HasPermission(BasePermission):
    """
    Require the SmartERP permission declared
    by the view.
    """

    message = (
        "Vous n'avez pas la permission "
        "d'effectuer cette action."
    )

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        membership = getattr(
            request,
            "membership",
            None,
        )

        if membership is None:
            return False

        permission_code = getattr(
            view,
            "required_permission",
            None,
        )

        if not permission_code:
            return False

        return can(
            membership=membership,
            permission_code=permission_code,
        )
