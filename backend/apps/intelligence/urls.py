from django.urls import path
from .views import ControlCenterView, AlertListView, AlertDetailView, AlertActionView, RefreshView, RunDetailView

urlpatterns = [
    path("ai/control-center/", ControlCenterView.as_view()),
    path("ai/control-center/refresh/", RefreshView.as_view()),
    path("ai/runs/<int:run_id>/", RunDetailView.as_view()),
    path("ai/alerts/", AlertListView.as_view()),
    path("ai/alerts/<int:alert_id>/", AlertDetailView.as_view()),
    path("ai/alerts/<int:alert_id>/<str:action>/", AlertActionView.as_view()),
    path("ai/anomalies/", AlertListView.as_view(kind="anomalies")),
    path("ai/risks/", AlertListView.as_view(kind="risks")),
]
