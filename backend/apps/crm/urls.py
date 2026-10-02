from django.urls import path
from .views import CustomerActivityView, CustomerDetailView, CustomerListView, CustomerSummaryView

urlpatterns = [
    path("customers/", CustomerListView.as_view()),
    path("customers/<int:customer_id>/", CustomerDetailView.as_view()),
    path("customers/<int:customer_id>/summary/", CustomerSummaryView.as_view()),
    path("customers/<int:customer_id>/activity/", CustomerActivityView.as_view()),
]
