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

class AdminCreateSerializer(serializers.ModelSerializer):
    """Validates input for creating a new admin user."""
    first_name = serializers.CharField(required=True, allow_blank=False)
    last_name = serializers.CharField(required=True, allow_blank=False)

    class Meta:
        model = AdminUser
        fields = ["first_name", "last_name", "email"]

    def validate_email(self, value):
        """Ensure no existing admin already uses this email (case-insensitive)."""
        if AdminUser.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An admin with this email already exists.")
        return value

class AdminUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminUser
        fields = ["first_name", "last_name", "email"]
