from django.urls import path
from .views import SupplierListView, SupplierDetailView, SupplierMetricsView, SupplierPriceHistoryView, PurchaseListView, PurchaseDetailView, PurchaseActionView

urlpatterns = [
    path("suppliers/", SupplierListView.as_view()),
    path("suppliers/<int:supplier_id>/", SupplierDetailView.as_view()),
    path("suppliers/<int:supplier_id>/metrics/", SupplierMetricsView.as_view()),
    path("suppliers/<int:supplier_id>/price-history/", SupplierPriceHistoryView.as_view()),
    path("purchase-orders/", PurchaseListView.as_view()),
    path("purchase-orders/<int:order_id>/", PurchaseDetailView.as_view()),
    *[path(f"purchase-orders/<int:order_id>/{action}/", PurchaseActionView.as_view(action=action)) for action in ("send", "confirm", "cancel", "receive")],
]

from .invoice_views import SupplierInvoiceListView, SupplierInvoiceDetailView, SupplierInvoiceActionView, SupplierInvoiceAgingView, PurchaseBillView

urlpatterns += [
    path("supplier-invoices/", SupplierInvoiceListView.as_view()),
    path("supplier-invoices/aging/", SupplierInvoiceAgingView.as_view()),
    path("supplier-invoices/<int:invoice_id>/", SupplierInvoiceDetailView.as_view()),
    *[path(f"supplier-invoices/<int:invoice_id>/{action}/", SupplierInvoiceActionView.as_view(action=action)) for action in ("post", "payment")],
    path("purchase-orders/<int:order_id>/bill/", PurchaseBillView.as_view()),
]
