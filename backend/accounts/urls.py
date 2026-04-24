from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.views import (
    AdminTokenObtainPairView,
    LogoutView,
    list_admins,
    get_admin,
    update_permissions,
)

urlpatterns = [
    path("login/", AdminTokenObtainPairView.as_view(), name="auth-login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="auth-token-refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
]
