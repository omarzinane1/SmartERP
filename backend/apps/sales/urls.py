from django.urls import path
from .views import QuoteActionView, QuoteDetailView, QuoteListView
from .order_views import QuoteConversionView, SalesOrderActionView, SalesOrderDetailView, SalesOrderListView
from .invoice_views import InvoiceActionView, InvoiceAgingView, InvoiceDetailView, InvoiceListView, OrderInvoiceView

urlpatterns = [
    path("invoices/", InvoiceListView.as_view()),
    path("invoices/aging/", InvoiceAgingView.as_view()),
    path("invoices/<int:invoice_id>/", InvoiceDetailView.as_view()),
    *[path(f"invoices/<int:invoice_id>/{action}/", InvoiceActionView.as_view(action=action)) for action in ("post", "credit-note", "payment", "remind")],
    path("sales-orders/<int:order_id>/invoice/", OrderInvoiceView.as_view()),
    path("sales-orders/", SalesOrderListView.as_view()),
    path("sales-orders/<int:order_id>/", SalesOrderDetailView.as_view()),
    *[path(f"sales-orders/<int:order_id>/{action}/", SalesOrderActionView.as_view(action=action)) for action in ("confirm", "processing", "cancel")],
    path("quotes/<int:quote_id>/convert/", QuoteConversionView.as_view()),
    path("quotes/", QuoteListView.as_view()),
    path("quotes/<int:quote_id>/", QuoteDetailView.as_view()),
    *[path(f"quotes/<int:quote_id>/{action}/", QuoteActionView.as_view(action=action)) for action in ("send", "accept", "reject", "viewed", "expire", "duplicate")],
]
