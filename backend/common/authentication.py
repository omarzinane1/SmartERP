from rest_framework.authentication import SessionAuthentication as DRFSessionAuthentication


class SessionAuthentication(DRFSessionAuthentication):
    """Django sessions and CSRF, with a 401 challenge for anonymous API requests."""

    def authenticate_header(self, request):
        return "Session"
