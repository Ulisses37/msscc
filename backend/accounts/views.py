import logging

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.views.decorators.csrf import csrf_protect
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from accounts.models import AdminUser
from accounts.permissions import IsExecutiveAdmin, IsSuperuserAdmin
from accounts.serializers import (
    AdminCreateSerializer,
    AdminTokenObtainPairSerializer,
    AdminUpdateSerializer,
    AdminUserSerializer,
    PasswordResetConfirmSerializer,
)
from emails.messages import send_password_reset_email

logger = logging.getLogger(__name__)


@method_decorator(csrf_protect, name="dispatch")
class AdminTokenObtainPairView(TokenObtainPairView):
    """Issue an access token and store the refresh token in an HttpOnly cookie."""

    serializer_class = AdminTokenObtainPairSerializer

    def post(self, request: Request, *args, **kwargs) -> Response:
        """Authenticate an admin and set their protected refresh-token cookie."""
        response = super().post(request, *args, **kwargs)
        refresh_token = response.data.pop("refresh", None)

        if not isinstance(refresh_token, str):
            raise InvalidToken("Unable to create a refresh token.")

        _set_refresh_cookie(response, refresh_token)
        return response


@method_decorator(csrf_protect, name="dispatch")
class CookieTokenRefreshView(APIView):
    """Rotate the refresh cookie and issue a current access token."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        """Issue current claims only when the protected refresh cookie is valid."""
        raw_refresh_token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        if not raw_refresh_token:
            raise InvalidToken("Refresh token is invalid or expired.")

        try:
            refresh_token = RefreshToken(raw_refresh_token)
            user = AdminUser.objects.get(pk=refresh_token["user_id"])
        except (AdminUser.DoesNotExist, KeyError, TokenError) as error:
            raise InvalidToken("Refresh token is invalid or expired.") from error

        if not user.is_active:
            raise InvalidToken("Refresh token is invalid or expired.")

        refresh_token.blacklist()
        replacement_refresh_token = AdminTokenObtainPairSerializer.get_token(user)
        response = Response({"access": str(replacement_refresh_token.access_token)})
        _set_refresh_cookie(response, str(replacement_refresh_token))
        return response


class CsrfTokenView(APIView):
    """Provide the CSRF token required for refresh-cookie requests."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        """Set Django's CSRF cookie and return its matching request token."""
        from django.middleware.csrf import get_token

        return Response({"csrf_token": get_token(request)})


@method_decorator(csrf_protect, name="dispatch")
class LogoutView(APIView):
    """Revoke the refresh cookie and clear it from the browser."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        """Blacklist the submitted refresh token when possible and clear the cookie."""
        raw_refresh_token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        if raw_refresh_token:
            try:
                RefreshToken(raw_refresh_token).blacklist()
            except TokenError:
                # Clearing an expired or malformed cookie is still a successful logout.
                pass

        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(
            settings.JWT_REFRESH_COOKIE_NAME,
            path=settings.JWT_REFRESH_COOKIE_PATH,
            samesite=settings.JWT_REFRESH_COOKIE_SAMESITE,
        )
        return response


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """Store a refresh token in a cookie unavailable to JavaScript."""
    response.set_cookie(
        key=settings.JWT_REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"],
        httponly=True,
        secure=settings.JWT_REFRESH_COOKIE_SECURE,
        samesite=settings.JWT_REFRESH_COOKIE_SAMESITE,
        path=settings.JWT_REFRESH_COOKIE_PATH,
    )


def _get_manageable_admin(request: Request, admin_id: int) -> AdminUser:
    """Return an account the acting admin is authorized to manage."""
    admin = get_object_or_404(AdminUser, pk=admin_id)
    if admin.is_superuser:
        raise PermissionDenied("Developer admin accounts cannot be changed here.")
    if admin.is_executive and not request.user.is_superuser:
        raise PermissionDenied("Only developer admins can manage executive admin accounts.")
    return admin


@api_view(["GET"])
@permission_classes([IsExecutiveAdmin])
def list_admins(request):
    """Return all admin users."""
    admins = AdminUser.objects.all()
    if not request.user.is_superuser:
        admins = admins.filter(is_executive=False, is_superuser=False)
    serializer = AdminUserSerializer(admins, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsExecutiveAdmin])
def get_admin(request, admin_id):
    """Return a single admin user."""
    admin = _get_manageable_admin(request, admin_id)
    serializer = AdminUserSerializer(admin)
    return Response(serializer.data)


@api_view(["PATCH"])
@permission_classes([IsExecutiveAdmin])
def update_permissions(request, admin_id):
    """Update permissions for an admin user."""
    admin = _get_manageable_admin(request, admin_id)
    permissions = request.data.get("permissions")
    if not isinstance(permissions, dict) or not all(
        isinstance(value, bool) for value in permissions.values()
    ):
        return Response(
            {"detail": "permissions must be an object with boolean values."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    admin.permissions_data = permissions
    admin.save(update_fields=["permissions_data", "updated_at"])
    return Response({"success": True})

@api_view(["POST"])
def password_reset_request(request):
    """Request a reset without disclosing account existence, or report email disabled."""
    if not settings.EMAIL_ENABLED:
        return Response({"detail": "Email is unavailable."}, status=503)
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
                logger.exception("Unable to send password reset email for admin %s.", user.pk)
        except AdminUser.DoesNotExist:
            # Do not reveal whether an account exists to a password-reset requester.
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

@api_view(["POST"])
@permission_classes([IsExecutiveAdmin])
def create_admin(request):
    """Create a new admin user and email them a link to set their password."""
    if not settings.EMAIL_ENABLED:
        return Response({"detail": "Email invitations are unavailable."}, status=503)
    serializer = AdminCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    admin = AdminUser.objects.create_user(
        email=serializer.validated_data["email"],
        password=None,
        first_name=serializer.validated_data["first_name"],
        last_name=serializer.validated_data["last_name"],
    )

    token = default_token_generator.make_token(admin)
    uid = urlsafe_base64_encode(force_bytes(admin.pk))
    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}&uid={uid}"

    try:
        send_password_reset_email(admin.email, reset_link)
    except Exception:
        logger.exception("Unable to send password setup email for admin %s.", admin.pk)

    return Response(AdminUserSerializer(admin).data, status=status.HTTP_201_CREATED)

@api_view(["DELETE"])
@permission_classes([IsExecutiveAdmin])
def delete_admin(request, admin_id):
    """Delete an admin user from the database"""
    admin = _get_manageable_admin(request, admin_id)

    if admin.pk == request.user.pk:
        return Response(
            {"detail": "You cannot delete your own account."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    admin.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(["PATCH"])
@permission_classes([IsExecutiveAdmin])
def update_admin(request, admin_id):
    """Update an existing admin name or email in the database"""
    admin = _get_manageable_admin(request, admin_id)

    serializer = AdminUpdateSerializer(admin, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    serializer.save()
    return Response(AdminUserSerializer(admin).data, status=status.HTTP_200_OK)

@api_view(["PATCH"])
@permission_classes([IsSuperuserAdmin])
def set_executive(request, admin_id):
    """Promote an existing admin to an executive admin"""
    admin = _get_manageable_admin(request, admin_id)

    is_executive = request.data.get("is_executive")
    if not isinstance(is_executive, bool):
        return Response(
            {"detail": "is_executive must be true or false."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    admin.is_executive = is_executive
    admin.save(update_fields=["is_executive"])
    return Response(status=status.HTTP_204_NO_CONTENT)


