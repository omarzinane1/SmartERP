from rest_framework.permissions import BasePermission


class HasActiveCompany(BasePermission):
    """
    Require an authenticated user with a valid active
    Membership and Company context.
    """

    message = "Aucune société active n'est associée à cette session."

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
        )