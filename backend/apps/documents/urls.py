from django.urls import path
from .views import DocumentListView, DocumentDetailView, DocumentDownloadView, DocumentPagesView, DocumentLinkView

urlpatterns = [
    path("documents/", DocumentListView.as_view()),
    path("documents/<int:document_id>/", DocumentDetailView.as_view()),
    path("documents/<int:document_id>/download/", DocumentDownloadView.as_view()),
    path("documents/<int:document_id>/preview/", DocumentDownloadView.as_view(preview=True)),
    path("documents/<int:document_id>/pages/", DocumentPagesView.as_view()),
    path("documents/<int:document_id>/link/", DocumentLinkView.as_view()),
    path("documents/<int:document_id>/link/<int:link_id>/", DocumentLinkView.as_view()),
]
