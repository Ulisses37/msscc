from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class AdminTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT serializer that adds email and first_name to the token payload."""

    @classmethod
    def get_token(cls, user):
        """Return token with additional user claims."""
        token = super().get_token(user)

        token["email"] = user.email
        token["first_name"] = user.first_name

        return token
