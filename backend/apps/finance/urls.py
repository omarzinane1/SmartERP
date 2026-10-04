from .expense_views import ExpenseListView, ExpenseDetailView, ExpenseActionView, ExpenseCategoryListView, ExpenseCategoryDetailView
from django.urls import path
from .views import PaymentListView, PaymentDetailView, PaymentSummaryView, PaymentActionView
from .summary_views import FinanceSummaryView

urlpatterns = [
    *[path(f"finance/{kind}/", FinanceSummaryView.as_view(kind=kind)) for kind in ("cash-flow", "upcoming-payments", "kpis")],
    path("expense-categories/", ExpenseCategoryListView.as_view()),
    path("expense-categories/<int:category_id>/", ExpenseCategoryDetailView.as_view()),
    path("expenses/", ExpenseListView.as_view()),
    path("expenses/<int:expense_id>/", ExpenseDetailView.as_view()),
    *[path(f"expenses/<int:expense_id>/{action}/", ExpenseActionView.as_view(action=action)) for action in ("submit", "approve", "reject", "cancel")],
    path("payments/", PaymentListView.as_view()),
    path("payments/summary/", PaymentSummaryView.as_view()),
    path("payments/<int:payment_id>/", PaymentDetailView.as_view()),
    *[path(f"payments/<int:payment_id>/{action}/", PaymentActionView.as_view(action=action)) for action in ("cancel", "allocate")],
]
