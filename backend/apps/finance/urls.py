from django.urls import path
from .views import PaymentListView, PaymentDetailView, PaymentSummaryView, PaymentActionView

urlpatterns = [
    path("payments/", PaymentListView.as_view()),
    path("payments/summary/", PaymentSummaryView.as_view()),
    path("payments/<int:payment_id>/", PaymentDetailView.as_view()),
    *[path(f"payments/<int:payment_id>/{action}/", PaymentActionView.as_view(action=action)) for action in ("cancel", "allocate")],
]
