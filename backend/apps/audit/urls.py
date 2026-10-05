from django.urls import path
from .views import AuditView

urlpatterns = []
for prefix in ["audit-logs/", "admin/audit-logs/"]:
    urlpatterns += [path(prefix, AuditView.as_view()), path(prefix+"export/", AuditView.as_view(export=True)), path(prefix+"<int:log_id>/", AuditView.as_view())]
