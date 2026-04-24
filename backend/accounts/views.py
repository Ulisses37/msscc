from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from accounts.models import AdminUser
from accounts.serializers import AdminTokenObtainPairSerializer, AdminUserSerializer


class AdminTokenObtainPairView(TokenObtainPairView):
    """Return access and refresh tokens for valid admin credentials."""

    serializer_class = AdminTokenObtainPairSerializer


class LogoutView(APIView):
    """Clear admin session and return 200. Token removal handled client-side."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        """Handle logout request."""
        return Response({"detail": "Successfully logged out."})


@api_view(["GET"])
def list_admins(request):
    """Return all admin users."""
    admins = AdminUser.objects.all()
    serializer = AdminUserSerializer(admins, many=True)
    return Response(serializer.data)


@api_view(["GET"])
def get_admin(request, admin_id):
    """Return a single admin user."""
    admin = AdminUser.objects.get(pk=admin_id)
    serializer = AdminUserSerializer(admin)
    return Response(serializer.data)


@api_view(["PATCH"])
def update_permissions(request, admin_id):
    """Update permissions for an admin user."""
    admin = AdminUser.objects.get(pk=admin_id)
    admin.permissions_data = request.data["permissions"]
    admin.save()
    return Response({"success": True})
