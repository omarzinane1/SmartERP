from apps.accounts.services import resolve_active_membership


class CompanyContextMiddleware:
    """
    Resolve the active company context for authenticated users.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.membership = None
        request.company = None

        if request.user.is_authenticated:
            membership = resolve_active_membership(
                request=request,
            )

            if membership is not None:
                request.membership = membership
                request.company = membership.company

        response = self.get_response(request)

        return response