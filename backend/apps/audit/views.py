from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from common.views import CompanyAPIView
from common.pagination import CollectionPagination
from apps.reporting.views import FileNegotiation
from apps.reporting.exports import export_response
from .serializers import AuditFilter
from .selectors import audit_queryset, audit_payload


class AuditView(CompanyAPIView):
    required_permission = "audit.view"
    content_negotiation_class = FileNegotiation
    export = False

    def get(self, request, log_id=None):
        serializer = AuditFilter(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        params = serializer.validated_data
        codes = self.codes()
        query = audit_queryset(request.company, params)
        if log_id is not None:
            obj = query.filter(pk=log_id).first()
            if obj is None:
                raise NotFound()
            return Response(audit_payload(obj, codes))
        if self.export:
            if "audit.export" not in codes:
                raise PermissionDenied()
            def rows():
                for obj in query.iterator(chunk_size=2000):
                    row = audit_payload(obj, codes)
                    yield [row[key] for key in ["timestamp", "actor", "module", "action", "entityType", "reference", "result"]]
            return export_response(["Date", "Acteur", "Module", "Action", "Entité", "Référence", "Résultat"], rows(), params["format"], f"audit.{params['format']}")
        pager = CollectionPagination()
        page = pager.paginate_queryset(query, request)
        return Response(pager.envelope(key="logs", rows=[audit_payload(obj, codes) for obj in page], **self.metadata(), canViewNetwork=False, exportFormats=["csv", "xlsx"] if "audit.export" in codes else []))
