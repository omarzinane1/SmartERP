from rest_framework.response import Response
from common.views import CompanyAPIView
from .dashboard import get_dashboard


class DashboardView(CompanyAPIView):
    required_permission = "analytics.view"

    def get(self, request):
        return Response(get_dashboard(request.company, self.codes()))
