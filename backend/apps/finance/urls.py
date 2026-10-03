from .expense_views import ExpenseListView, ExpenseDetailView, ExpenseActionView
from django.urls import path
from .views import PaymentListView, PaymentDetailView, PaymentSummaryView, PaymentActionView

urlpatterns = [
    path("expenses/", ExpenseListView.as_view()),
    path("expenses/<int:expense_id>/", ExpenseDetailView.as_view()),
    *[path(f"expenses/<int:expense_id>/{action}/", ExpenseActionView.as_view(action=action)) for action in ("submit", "approve", "reject")],
    path("payments/", PaymentListView.as_view()),
    path("payments/summary/", PaymentSummaryView.as_view()),
    path("payments/<int:payment_id>/", PaymentDetailView.as_view()),
    *[path(f"payments/<int:payment_id>/{action}/", PaymentActionView.as_view(action=action)) for action in ("cancel", "allocate")],
]
