from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from accounts.models import AdminUser


class AdminTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT serializer that adds email and first_name to the token payload."""

    @classmethod
    def get_token(cls, user):
        """Return token with additional user claims."""
        token = super().get_token(user)

        token["email"] = user.email
        token["first_name"] = user.first_name

        return token


class AdminUserSerializer(serializers.ModelSerializer):
    """Serializer for admin user records on the permissions page."""

    permissions = serializers.JSONField(source="permissions_data")

    class Meta:
        model = AdminUser
        fields = [
            "id",
            "first_name",
            "last_name",
            "email",
            "is_executive",
            "permissions",
        ]

class PasswordResetConfirmSerializer(serializers.Serializer):
    """Validates input for password reset confirmation."""

    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8)
