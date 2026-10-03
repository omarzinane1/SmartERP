from django.urls import path
from . import views

urlpatterns = [
    path("products/", views.ProductListView.as_view()),
    path("products/<int:product_id>/", views.ProductDetailView.as_view()),
    path("products/<int:product_id>/metrics/", views.ProductMetricsView.as_view()),
    path("products/<int:product_id>/history/", views.ProductHistoryView.as_view()),
    path("product-categories/", views.ReferenceListView.as_view(kind="category")),
    path("units/", views.ReferenceListView.as_view(kind="unit")),
    path("warehouses/", views.WarehouseListView.as_view()),
    path("warehouses/summary/", views.WarehouseListView.as_view(summary_only=True)),
    path("warehouses/<int:warehouse_id>/", views.WarehouseDetailView.as_view()),
    *[path(f"warehouses/<int:warehouse_id>/{part}/", views.WarehouseDetailView.as_view(part=part)) for part in ("inventory", "movements", "valuation")],
    path("inventory/summary/", views.InventorySummaryView.as_view()),
    path("inventory/health/", views.InventorySummaryView.as_view(part="health")),
    path("inventory/critical/", views.InventorySummaryView.as_view(part="critical")),
    path("inventory/low-stock/", views.InventorySummaryView.as_view(part="critical")),
    path("inventory/movements/", views.MovementListView.as_view()),
    path("inventory/recent-movements/", views.MovementListView.as_view(recent=True)),
    path("inventory/movements/<int:movement_id>/", views.MovementDetailView.as_view()),
    path("inventory/transfers/", views.TransferListView.as_view()),
    path("inventory/transfers/<int:transfer_id>/", views.TransferDetailView.as_view()),
    *[path(f"inventory/transfers/<int:transfer_id>/{action}/", views.TransferActionView.as_view(action=action)) for action in ("ready", "start", "complete", "cancel")],
]
