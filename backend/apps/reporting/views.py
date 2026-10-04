from django.http import FileResponse
from rest_framework.exceptions import NotFound
from rest_framework.negotiation import DefaultContentNegotiation
from rest_framework.response import Response
from common.views import CompanyAPIView
from common.dates import company_today
from .serializers import ExportInput, GenerateExportInput
from .registry import dataset_spec, dataset_rows
from .exports import export_response, MIMES
from . import services, selectors as read


class FileNegotiation(DefaultContentNegotiation):
    def select_renderer(self, request, renderers, format_suffix=None):
        # `format` selects the exported file, not a DRF browsable API renderer.
        return renderers[0], renderers[0].media_type


class ExportView(CompanyAPIView):
    content_negotiation_class = FileNegotiation

    @property
    def required_permission(self):
        return dataset_spec(self.kwargs["entity"], self.codes()).export

    def render_export(self, request, entity, values):
        spec = dataset_spec(entity, self.codes())
        serializer = ExportInput(data=values)
        serializer.is_valid(raise_exception=True)
        filters = serializer.validated_data
        format = filters.pop("format")
        rows = dataset_rows(request.company, spec, filters)
        return export_response([label for _, label in spec.columns], rows, format, f"{entity}-{company_today(request.company).isoformat()}.{format}")

    def get(self, request, entity):
        return self.render_export(request, entity, request.query_params)

    def post(self, request, entity):
        return self.render_export(request, entity, request.data)


class ReportCatalogView(CompanyAPIView):
    required_permission = "reports.view"

    def get(self, request):
        return Response(dict(reports=read.catalog(request.company, self.codes()), **self.metadata()))


class RecentReportsView(CompanyAPIView):
    required_permission = "reports.view"

    def get(self, request):
        return Response([read.generated_payload(obj, request) for obj in read.generated_queryset(request.company, self.codes())[:50]])


class GenerateReportView(CompanyAPIView):
    required_permission = "reports.generate"

    def post(self, request):
        obj = services.generate_export(company=request.company, membership=request.membership, data=self.validated(GenerateExportInput))
        return Response(read.generated_payload(obj, request), status=201)


class GeneratedDownloadView(CompanyAPIView):
    required_permission = "reports.view"

    def get(self, request, export_id):
        obj = read.generated_queryset(request.company, self.codes()).filter(pk=export_id).first()
        if obj is None:
            raise NotFound()
        try:
            stream = obj.file.open("rb")
        except FileNotFoundError as error:
            raise NotFound("Fichier indisponible.") from error
        response = FileResponse(stream, as_attachment=True, filename=obj.filename, content_type=MIMES[obj.format])
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response
