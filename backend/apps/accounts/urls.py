from django.urls import include, path

from .views import (
    CSRFTokenView,
    LoginView,
    LogoutView,
    SessionView,
)


app_name = "accounts"


urlpatterns = [
    path(
        "csrf/",
        CSRFTokenView.as_view(),
        name="csrf",
    ),

    path(
        "login/",
        LoginView.as_view(),
        name="login",
    ),

    path(
        "session/",
        SessionView.as_view(),
        name="session",
    ),

    path(
        "logout/",
        LogoutView.as_view(),
        name="logout",
    ),
    #path(
    #    "api/auth/",
    #    include("apps.accounts.urls"),
    #)
]