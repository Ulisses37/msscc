from django.urls import path
from rest_framework_simplejwt.views import TokenVerifyView

from accounts.views import (
    AdminTokenObtainPairView,
    CookieTokenRefreshView,
    CsrfTokenView,
    LogoutView,
    password_reset_confirm,
    password_reset_request,
)

urlpatterns = [
    path("csrf/", CsrfTokenView.as_view(), name="auth-csrf"),
    path("login/", AdminTokenObtainPairView.as_view(), name="auth-login"),
    path("token/refresh/", CookieTokenRefreshView.as_view(), name="auth-token-refresh"),
    path("token/verify/", TokenVerifyView.as_view(), name="auth-token-verify"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("password-reset/", password_reset_request, name="auth-password-reset"),
    path("password-reset/confirm/", password_reset_confirm, name="auth-password-reset-confirm"),
]
