from django.db.models import Q, Exists, OuterRef
from rest_framework.exceptions import NotFound
from .models import Document, DocumentLink
from .registry import ENTITIES, entity_queryset, entity_path


def document_queryset(company, membership, permissions, include_deleted=False):
    query = Document.objects.filter(company=company).filter(Q(visibility="company") | Q(uploaded_by_id=membership.user_id))
    if not include_deleted:
        query = query.filter(deleted_at__isnull=True)
    allowed = Q(pk__in=[])
    for kind, spec in ENTITIES.items():
        if spec.permission in permissions:
            allowed |= Q(entity_type=kind, entity_id__in=entity_queryset(company, kind).values("pk"), company=company)
    invalid = DocumentLink.objects.filter(document_id=OuterRef("pk")).exclude(allowed)
    return query.annotate(has_forbidden_link=Exists(invalid)).filter(has_forbidden_link=False).select_related("uploaded_by").prefetch_related("links")


def document_by_id(company, membership, permissions, pk, include_deleted=False):
    obj = document_queryset(company, membership, permissions, include_deleted).filter(pk=pk).first()
    if obj is None:
        raise NotFound()
    return obj


def link_payload(link):
    return dict(id=link.pk, entityType=link.entity_type, entityId=link.entity_id, label=ENTITIES[link.entity_type].label, path=entity_path(link.entity_type, link.entity_id))


def document_payload(obj, permissions, request):
    return dict(id=obj.pk, name=obj.name, mime=obj.mime_type, category=obj.category, department=obj.department,
        author=obj.uploaded_by.get_full_name() or obj.uploaded_by.email, size=obj.size, createdAt=obj.created_at.isoformat(), status="uploaded",
        visibility="Privé" if obj.visibility == "private" else "Public entreprise", pageCount=obj.page_count, canView=True,
        url=request.build_absolute_uri(f"/api/documents/{obj.pk}/download/"), previewUrl=request.build_absolute_uri(f"/api/documents/{obj.pk}/preview/"),
        links=[link_payload(link) for link in obj.links.all()], capabilities=dict(canDelete="documents.delete" in permissions, canIndex=False, canDownload=True, canAnalyze=False), indexError=None)


def entity_documents(company, membership, permissions, kind, pk):
    if "documents.view" not in permissions:
        return Document.objects.none()
    return document_queryset(company, membership, permissions).filter(links__company=company, links__entity_type=kind, links__entity_id=pk)
