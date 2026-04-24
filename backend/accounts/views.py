from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from accounts.serializers import AdminTokenObtainPairSerializer


class AdminTokenObtainPairView(TokenObtainPairView):
    """Return access and refresh tokens for valid admin credentials."""

    serializer_class = AdminTokenObtainPairSerializer


class LogoutView(APIView):
    """Clear admin session and return 200. Token removal handled client-side."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        """Handle logout request."""
        return Response({"detail": "Successfully logged out."})
