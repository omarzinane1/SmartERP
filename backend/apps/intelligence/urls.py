from django.urls import path
from .views import ControlCenterView, AlertListView, AlertDetailView, AlertActionView, RefreshView, RunDetailView, ForecastListView, ForecastDetailView

from .views import OpportunityListView, OpportunityDetailView, OpportunityActionView

urlpatterns = [
    path("ai/opportunities/", OpportunityListView.as_view()),
    path("ai/opportunities/<int:opportunity_id>/", OpportunityDetailView.as_view()),
    path("ai/opportunities/<int:opportunity_id>/<str:action>/", OpportunityActionView.as_view()),
    path("ai/forecasts/", ForecastListView.as_view()),
    path("ai/forecasts/<int:forecast_id>/", ForecastDetailView.as_view()),
    path("ai/control-center/", ControlCenterView.as_view()),
    path("ai/control-center/refresh/", RefreshView.as_view()),
    path("ai/runs/<int:run_id>/", RunDetailView.as_view()),
    path("ai/alerts/", AlertListView.as_view()),
    path("ai/alerts/<int:alert_id>/", AlertDetailView.as_view()),
    path("ai/alerts/<int:alert_id>/<str:action>/", AlertActionView.as_view()),
    path("ai/anomalies/", AlertListView.as_view(kind="anomalies")),
    path("ai/risks/", AlertListView.as_view(kind="risks")),
]
