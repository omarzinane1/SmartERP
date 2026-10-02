from django.urls import path
from .admin_views import AdminInvitationsView, AdminPermissionsView, AdminRoleDetailView, AdminRolesView, AdminUserDetailView, AdminUsersView

urlpatterns = [
    path("users/", AdminUsersView.as_view()),
    path("users/<int:user_id>/", AdminUserDetailView.as_view()),
    path("invitations/", AdminInvitationsView.as_view()),
    path("roles/", AdminRolesView.as_view()),
    path("roles/<int:role_id>/", AdminRoleDetailView.as_view()),
    path("permissions/", AdminPermissionsView.as_view()),
]
