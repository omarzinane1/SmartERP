from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from common.views import CompanyAPIView
from common.pagination import CollectionPagination
from .models import IntelligenceRun
from .serializers import AlertFilters, EmptyAction
from .selectors import alert_queryset, alert_by_id, alert_payload, filtered_alerts, risk_queryset, risk_payload, run_payload, control_center
from .services import request_refresh, transition_alert, expire_runs


class IntelligenceView(CompanyAPIView):
    required_permission = "ai.use"


class ControlCenterView(IntelligenceView):
    def get(self, request):
        expire_runs(IntelligenceRun.objects.filter(company=request.company))
        return Response(control_center(request.company, request.membership))


class AlertListView(IntelligenceView):
    kind = "alerts"

    def get(self, request):
        filters = AlertFilters(data=request.query_params)
        filters.is_valid(raise_exception=True)
        query = filtered_alerts(alert_queryset(request.company, self.codes()), filters.validated_data, request.company)
        if self.kind == "risks":
            query = risk_queryset(query)
        pager = CollectionPagination()
        page = pager.paginate_queryset(query, request)
        payload = risk_payload if self.kind == "risks" else alert_payload
        return Response(pager.envelope(key=self.kind, rows=[payload(obj) for obj in page], source="RULE_BASED"))


class AlertDetailView(IntelligenceView):
    def get(self, request, alert_id):
        return Response(alert_payload(alert_by_id(request.company, self.codes(), alert_id)))


class AlertActionView(IntelligenceView):
    def post(self, request, alert_id, action):
        self.validated(EmptyAction)
        return Response(alert_payload(transition_alert(company=request.company, membership=request.membership, alert_id=alert_id, action=action)))


class RefreshView(IntelligenceView):
    def post(self, request):
        self.validated(EmptyAction)
        run = request_refresh(company=request.company, membership=request.membership, key=request.headers.get("Idempotency-Key"))
        run.refresh_from_db()
        return Response(run_payload(run, self.codes()), status=202)


class RunDetailView(IntelligenceView):
    def get(self, request, run_id):
        query = IntelligenceRun.objects.filter(company=request.company, requested_by_id=request.membership.user_id, pk=run_id)
        expire_runs(query)
        run = query.first()
        if run is None:
            raise NotFound()
        return Response(run_payload(run, self.codes()))
