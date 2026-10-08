from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from common.permissions import HasActiveCompany
from common.views import CompanyAPIView
from common.pagination import CollectionPagination
from apps.sales.serializers import EmptyActionSerializer
from .selectors import notification_queryset, notification_payload
from .services import mark_notification_read, mark_all_notifications_read


class NotificationListView(CompanyAPIView):
    permission_classes = [IsAuthenticated, HasActiveCompany]

    def get(self, request):
        query = notification_queryset(request.company, request.membership)
        pager = CollectionPagination()
        page = pager.paginate_queryset(query, request)
        return Response(pager.envelope(key="notifications", rows=[notification_payload(obj) for obj in page], unreadCount=query.filter(is_read=False).count(), **self.metadata()))


class NotificationReadView(CompanyAPIView):
    permission_classes = [IsAuthenticated, HasActiveCompany]

    def post(self, request, notification_id=None):
        self.validated(EmptyActionSerializer)
        if notification_id:
            return Response(notification_payload(mark_notification_read(company=request.company, membership=request.membership, notification_id=notification_id)))
        return Response(dict(updated=mark_all_notifications_read(company=request.company, membership=request.membership)))
