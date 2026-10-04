from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.accounts.selectors import get_effective_permission_codes
from common.dates import company_today
from common.pagination import CollectionPagination
from common.permissions import HasActiveCompany, HasPermission


class CompanyAPIView(APIView):
    permission_classes = [IsAuthenticated, HasActiveCompany, HasPermission]

    def codes(self):
        return get_effective_permission_codes(membership=self.request.membership)

    def metadata(self):
        return dict(permissions=self.codes(), asOf=company_today(self.request.company).isoformat())

    def page(self, request, key, rows, **metadata):
        pager = CollectionPagination()
        page = pager.paginate_queryset(rows, request)
        return Response(pager.envelope(key=key, rows=page, **self.metadata(), **metadata))

    def validated(self, serializer, *, partial=False):
        value = serializer(data=self.request.data, partial=partial)
        value.is_valid(raise_exception=True)
        return value.validated_data
