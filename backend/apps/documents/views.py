from django.http import FileResponse
from rest_framework.exceptions import NotFound
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from common.views import CompanyAPIView
from common.pagination import CollectionPagination
from . import selectors as read, services
from .serializers import DocumentUpload, DocumentLinkInput, DocumentFilter
from .validators import MAX_BYTES, TYPES
from .registry import ENTITIES


class DocumentListView(CompanyAPIView):
    parser_classes = [MultiPartParser, FormParser]

    @property
    def required_permission(self):
        return "documents.upload" if self.request.method == "POST" else "documents.view"

    def get(self, request):
        filters = DocumentFilter(data=request.query_params)
        filters.is_valid(raise_exception=True)
        query = read.document_queryset(request.company, request.membership, self.codes())
        values = filters.validated_data
        if values.get("search"):
            query = query.filter(name__icontains=values["search"])
        for key in ("category", "department"):
            if key in values:
                query = query.filter(**{key: values[key]})
        if "entity_type" in values or "entity_id" in values:
            query = query.filter(**{f"links__{key}": values[key] for key in ("entity_type", "entity_id") if key in values}).distinct()
        pager = CollectionPagination()
        rows = pager.paginate_queryset(query, request)
        return Response(pager.envelope(key="documents", rows=[read.document_payload(obj, self.codes(), request) for obj in rows], **self.metadata(),
            acceptedTypes=[dict(extension=ext, mime=mime) for ext, mime in TYPES.items()], maxBytes=MAX_BYTES, visibilityOptions=["Public entreprise", "Privé"]))

    def post(self, request):
        obj = services.upload_document(company=request.company, membership=request.membership, data=self.validated(DocumentUpload))
        return Response(read.document_payload(obj, self.codes(), request), status=201)


class DocumentDetailView(CompanyAPIView):
    @property
    def required_permission(self):
        return "documents.delete" if self.request.method == "DELETE" else "documents.view"

    def get(self, request, document_id):
        obj = read.document_by_id(request.company, request.membership, self.codes(), document_id)
        return Response(dict(**read.document_payload(obj, self.codes(), request), **self.metadata(),
            linkTypes=[dict(value=kind, label=spec.label) for kind, spec in ENTITIES.items() if spec.permission in self.codes()]))

    def delete(self, request, document_id):
        services.delete_document(company=request.company, membership=request.membership, document_id=document_id)
        return Response(status=204)


class DocumentDownloadView(CompanyAPIView):
    required_permission = "documents.view"
    preview = False

    def get(self, request, document_id):
        obj = read.document_by_id(request.company, request.membership, self.codes(), document_id)
        try:
            stream = obj.file.open("rb")
        except FileNotFoundError as error:
            raise NotFound("Fichier indisponible.") from error
        inline = self.preview and obj.mime_type.startswith("image/")
        response = FileResponse(stream, as_attachment=not inline, filename=obj.original_filename, content_type=obj.mime_type)
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        response["Content-Security-Policy"] = "default-src 'none'; sandbox"
        return response


class DocumentPagesView(CompanyAPIView):
    required_permission = "documents.view"

    def get(self, request, document_id):
        obj = read.document_by_id(request.company, request.membership, self.codes(), document_id)
        text = None
        if obj.mime_type == "text/plain":
            try:
                with obj.file.open("rb") as stream:
                    text = stream.read(MAX_BYTES).decode("utf-8-sig")
            except FileNotFoundError as error:
                raise NotFound("Fichier indisponible.") from error
        preview = request.build_absolute_uri(f"/api/documents/{obj.pk}/preview/") if obj.mime_type.startswith("image/") else None
        return Response([dict(number=number, title=f"Page {number}", text=text[(number-1)*10000:number*10000] if text is not None else None,
            imageUrl=preview, thumbnailUrl=preview, simulated=False) for number in range(1, obj.page_count+1)])


class DocumentLinkView(CompanyAPIView):
    required_permission = "documents.upload"

    def post(self, request, document_id):
        obj = services.link_document(company=request.company, membership=request.membership, document_id=document_id, data=self.validated(DocumentLinkInput))
        return Response(read.link_payload(obj), status=201)

    def delete(self, request, document_id, link_id):
        services.unlink_document(company=request.company, membership=request.membership, document_id=document_id, link_id=link_id)
        return Response(status=204)
