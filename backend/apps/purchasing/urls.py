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
