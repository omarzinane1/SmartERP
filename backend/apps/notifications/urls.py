from django.urls import path
from .views import NotificationListView, NotificationReadView

urlpatterns = [path("notifications/", NotificationListView.as_view()), path("notifications/read-all/", NotificationReadView.as_view()), path("notifications/<int:notification_id>/read/", NotificationReadView.as_view())]
