from django.urls import path
from .views import NotificationListView, NotificationReadView
from .email_views import EmailHistoryView

urlpatterns = [path("notifications/", NotificationListView.as_view()), path("notifications/read-all/", NotificationReadView.as_view()), path("notifications/<int:notification_id>/read/", NotificationReadView.as_view())]
urlpatterns += [path("business-emails/", EmailHistoryView.as_view())]
