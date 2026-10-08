from django.http import FileResponse
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.companies.serializers import StrictSerializer
from apps.sales.serializers import EmptyActionSerializer
from common.exceptions import BusinessConflict
from common.permissions import HasActiveCompany
from common.views import CompanyAPIView
from common.pagination import CollectionPagination
from .serializers import GenerateExportInput
from .job_services import request_job, retry_job, expire_jobs
from .job_selectors import job_queryset, owned_job, job_payload
from .exports import MIMES


class PDFJobInput(StrictSerializer):
    entity_type = serializers.ChoiceField(choices=["invoice", "quote"])
    entity_id = serializers.IntegerField(min_value=1)


class JobView(CompanyAPIView):
    permission_classes = [IsAuthenticated, HasActiveCompany]


class JobCreateView(JobView):
    pdf = False

    def post(self, request):
        obj = request_job(company=request.company, membership=request.membership, data=self.validated(PDFJobInput if self.pdf else GenerateExportInput),
            key=request.headers.get("Idempotency-Key"), pdf=self.pdf)
        obj.refresh_from_db()  # on_commit may have reported a broker failure.
        return Response(job_payload(obj), status=202)


class JobListView(JobView):
    def get(self, request):
        query = job_queryset(request.company, request.membership)
        expire_jobs(query)
        pager = CollectionPagination()
        page = pager.paginate_queryset(query, request)
        return Response(pager.envelope(key="jobs", rows=[job_payload(obj) for obj in page], **self.metadata()))


class JobDetailView(JobView):
    def get(self, request, job_id):
        obj = owned_job(request.company, request.membership, job_id)
        expire_jobs(job_queryset(request.company, request.membership).filter(pk=obj.pk))
        obj.refresh_from_db()
        return Response(job_payload(obj))


class JobRetryView(JobView):
    def post(self, request, job_id):
        self.validated(EmptyActionSerializer)
        obj = retry_job(company=request.company, membership=request.membership, job_id=job_id)
        obj.refresh_from_db()
        return Response(job_payload(obj), status=202)


class JobDownloadView(JobView):
    def get(self, request, job_id):
        obj = owned_job(request.company, request.membership, job_id)
        if obj.status != "completed":
            raise BusinessConflict("Le fichier n’est pas encore disponible.")
        try:
            stream = obj.result_file.open("rb")
        except FileNotFoundError as error:
            raise NotFound("Fichier indisponible.") from error
        response = FileResponse(stream, as_attachment=True, filename=obj.filename, content_type="application/pdf" if obj.format == "pdf" else MIMES[obj.format])
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response
