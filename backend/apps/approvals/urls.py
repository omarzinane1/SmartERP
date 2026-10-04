from django.urls import path
from .views import ApprovalListView, ApprovalDetailView, ApprovalActionView

urlpatterns = [
    path("approvals/", ApprovalListView.as_view()),
    path("approvals/<int:request_id>/", ApprovalDetailView.as_view()),
    *[path(f"approvals/<int:request_id>/{action}/", ApprovalActionView.as_view(action=action)) for action in ("approve", "reject", "cancel")],
]
