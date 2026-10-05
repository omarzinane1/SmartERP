from django.urls import path
from .views import ExportView, ReportCatalogView, RecentReportsView, GenerateReportView, GeneratedDownloadView
from .dashboard_views import DashboardView
from .analytics_views import AnalyticsView
from .pdf_views import CommercialPDFView

urlpatterns = [
    path("dashboard/summary/", DashboardView.as_view()),
    path("dashboard/executive/", DashboardView.as_view()),
    path("invoices/<int:document_id>/pdf/", CommercialPDFView.as_view()),
    path("quotes/<int:document_id>/pdf/", CommercialPDFView.as_view(kind="quote")),
    path("exports/<slug:entity>/", ExportView.as_view()),
    path("reports/catalog/", ReportCatalogView.as_view()),
    path("reports/recent/", RecentReportsView.as_view()),
    path("reports/generate/", GenerateReportView.as_view()),
    path("reports/generated/<int:export_id>/download/", GeneratedDownloadView.as_view()),
    path("reports/<slug:kind>/", AnalyticsView.as_view()),
    path("reports/<slug:kind>/export/", AnalyticsView.as_view(export=True)),
]
