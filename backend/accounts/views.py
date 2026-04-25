from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from accounts.models import AdminUser
from accounts.utils import send_password_reset_email
from accounts.serializers import (
    AdminTokenObtainPairSerializer,
    AdminUserSerializer,
    PasswordResetConfirmSerializer,
)

from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.conf import settings
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode


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

@api_view(["POST"])
def password_reset_request(request):
    """Send a password reset link to the email if an account exists. Always returns 200."""
    email = request.data.get("email", "").strip()

    if email:
        try:
            user = AdminUser.objects.get(email=email)
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}&uid={uid}"

            try:
                send_password_reset_email(user.email, reset_link)
            except Exception:
                pass
        except AdminUser.DoesNotExist:
            pass

    return Response(
        {"detail": "If an account exists with that email, a reset link has been sent."}
    )

@api_view(["POST"])
def password_reset_confirm(request):
    """Validate the reset token and set a new password. Token is single-use."""
    serializer = PasswordResetConfirmSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    uid = serializer.validated_data["uid"]
    token = serializer.validated_data["token"]
    new_password = serializer.validated_data["new_password"]

    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = AdminUser.objects.get(pk=user_id)
    except (ValueError, AdminUser.DoesNotExist):
        return Response(
            {"detail": "Invalid or expired reset link."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not default_token_generator.check_token(user, token):
        return Response(
            {"detail": "Invalid or expired reset link."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user.set_password(new_password)
    user.save()

    return Response({"detail": "Password reset successfully."})
