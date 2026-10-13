from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from common.views import CompanyAPIView
from common.pagination import CollectionPagination
from .models import IntelligenceRun
from .serializers import AlertFilters, EmptyAction, RefreshInput, ForecastFilters
from .selectors import alert_queryset, alert_by_id, alert_payload, filtered_alerts, risk_queryset, risk_payload, run_payload, control_center, forecast_queryset, forecast_payload
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
        return Response(pager.envelope(key=self.kind, rows=[payload(obj) for obj in page], source="rule_based_and_statistical"))


class AlertDetailView(IntelligenceView):
    def get(self, request, alert_id):
        return Response(alert_payload(alert_by_id(request.company, self.codes(), alert_id)))


class AlertActionView(IntelligenceView):
    def post(self, request, alert_id, action):
        self.validated(EmptyAction)
        return Response(alert_payload(transition_alert(company=request.company, membership=request.membership, alert_id=alert_id, action=action)))


class RefreshView(IntelligenceView):
    def post(self, request):
        params = self.validated(RefreshInput)
        run = request_refresh(company=request.company, membership=request.membership, key=request.headers.get("Idempotency-Key"), **params)
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


class ForecastListView(IntelligenceView):
    def get(self, request):
        from rest_framework.exceptions import PermissionDenied
        if "forecast.view" not in self.codes():
            raise PermissionDenied()
        filters = ForecastFilters(data=request.query_params)
        filters.is_valid(raise_exception=True)
        query = forecast_queryset(request.company, self.codes()).select_related("company")
        for key in ["metric", "horizon", "granularity"]:
            if key in filters.validated_data:
                query = query.filter(**{key: filters.validated_data[key]})
        pager = CollectionPagination()
        page = pager.paginate_queryset(query, request)
        return Response(pager.envelope(key="forecasts", rows=[forecast_payload(obj) for obj in page]))


class ForecastDetailView(IntelligenceView):
    def get(self, request, forecast_id):
        obj = forecast_queryset(request.company, self.codes()).select_related("company").filter(pk=forecast_id).first()
        if obj is None:
            raise NotFound()
        return Response(forecast_payload(obj))


class OpportunityListView(IntelligenceView):
    def get(self, request):
        from .serializers import OpportunityFilters
        from .opportunity_selectors import require_opportunities, opportunity_queryset, filtered_opportunities, opportunity_payload
        from .opportunity_config import allowed_types
        codes = self.codes()
        require_opportunities(codes)
        filters = OpportunityFilters(data=request.query_params)
        filters.is_valid(raise_exception=True)
        query = filtered_opportunities(opportunity_queryset(request.company, codes), filters.validated_data, request.company)
        pager = CollectionPagination()
        page = pager.paginate_queryset(query, request)
        runs = IntelligenceRun.objects.filter(company=request.company, requested_by_id=request.membership.user_id)
        expire_runs(runs)
        latest = runs.first()
        return Response(pager.envelope(key="opportunities", rows=[opportunity_payload(obj) for obj in page],
            **self.metadata(), availableTypes=allowed_types(codes), lastRun=run_payload(latest, codes) if latest else None))


class OpportunityDetailView(IntelligenceView):
    def get(self, request, opportunity_id):
        from .opportunity_selectors import require_opportunities, opportunity_queryset, opportunity_payload
        codes = self.codes()
        require_opportunities(codes)
        obj = opportunity_queryset(request.company, codes).filter(pk=opportunity_id).first()
        if obj is None:
            raise NotFound()
        return Response(opportunity_payload(obj))


class OpportunityActionView(IntelligenceView):
    def post(self, request, opportunity_id, action):
        from .opportunity_services import transition_opportunity
        from .opportunity_selectors import opportunity_payload
        self.validated(EmptyAction)
        return Response(opportunity_payload(transition_opportunity(company=request.company, membership=request.membership,
            opportunity_id=opportunity_id, action=action)))
