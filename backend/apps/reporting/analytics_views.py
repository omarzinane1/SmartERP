from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from common.views import CompanyAPIView
from common.pagination import CollectionPagination
from . import analytics as read
from .exports import export_response
from .views import FileNegotiation


class AnalyticsView(CompanyAPIView):
    required_permission = "reports.view"
    content_negotiation_class = FileNegotiation
    export = False

    def get(self, request, kind):
        codes = self.codes()
        spec = read.report_spec(kind, codes)
        serializer = read.AnalyticsInput(data=request.query_params, context={"company": request.company})
        serializer.is_valid(raise_exception=True)
        params = serializer.validated_data
        if self.export and "reports.export" not in codes:
            raise PermissionDenied()
        query, source = read.filtered_dataset(request.company, kind, codes, params)
        rows = read.ordered_rows(query, params)
        if self.export:
            columns = ["r_reference", "r_name", "r_date", "r_amount", "r_quantity", "r_group", "r_owner"]
            return export_response(["Référence", "Libellé", "Date", spec[3], "Quantité", "Groupe", "Responsable"],
                ([row[key] for key in columns] for row in rows.iterator(chunk_size=2000)), params["format"], f"{kind}.{params['format']}")
        pager = CollectionPagination()
        page = pager.paginate_queryset(rows, request)
        return Response(pager.envelope(key="rows", rows=[read.row_payload(row, spec[4]) for row in page], **self.metadata(),
            **read.report_metadata(request.company, kind, codes, params, query, source)))
