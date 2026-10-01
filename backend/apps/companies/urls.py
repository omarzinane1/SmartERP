from django.urls import path

from .views import CompanyOnboardingView

app_name = "companies"

urlpatterns = [
    path("onboarding/", CompanyOnboardingView.as_view(), name="onboarding"),
]
