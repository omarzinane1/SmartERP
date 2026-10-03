from django.contrib import admin
from django.urls import include, path

from apps.accounts.views import MeView
from apps.companies.views import CompanySettingsView, CompanySettingsSectionView


urlpatterns = [
    path("api/", include("apps.purchasing.urls")),
    path("api/", include("apps.finance.urls")),
    path("api/", include("apps.sales.urls")),
    path("api/", include("apps.crm.urls")),
    path("api/admin/", include("apps.accounts.admin_urls")),
    path("api/settings/", CompanySettingsView.as_view()),
    path("api/settings/<str:section>/", CompanySettingsSectionView.as_view()),
    path("api/company/", include("apps.companies.urls")),
    path(
        "admin/",
        admin.site.urls,
    ),

    path(
        "api/auth/",
        include("apps.accounts.urls"),
    ),

    path(
        "api/me/",
        MeView.as_view(),
        name="me",
    ),
]
