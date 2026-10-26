from rest_framework import serializers

from emails.models import Subscriber

# Field name for the hidden input that only a bot fills in. Kept here so the
# view and the frontend component cannot disagree about it.
HONEYPOT_FIELD = "website"

# Raw confirmation tokens are URL-safe base64 from secrets.token_urlsafe, so
# anything outside this alphabet cannot be one of ours and is rejected before it
# reaches a database lookup.
CONFIRMATION_TOKEN_PATTERN = r"^[A-Za-z0-9_-]{20,200}$"


class SubscribeRequestSerializer(serializers.Serializer):
    """Validate a mailing-list signup from any public entry point."""

    email = serializers.EmailField(max_length=254)
    source = serializers.ChoiceField(choices=Subscriber.Source.choices)
    # A real person leaves this blank; it is invisible in the UI.
    website = serializers.CharField(
        required=False, allow_blank=True, max_length=255, default=""
    )

    def validate_email(self, value: str) -> str:
        """Normalize the address so it matches how Subscriber stores it."""
        return value.strip().casefold()


class SubscribeConfirmRequestSerializer(serializers.Serializer):
    """Validate a confirmation token from the landing page.

    The token is a one-time secret. An unknown, expired, reused or malformed
    value all get the same generic rejection from the view, so a caller cannot
    tell which case it hit.
    """

    token = serializers.RegexField(CONFIRMATION_TOKEN_PATTERN, max_length=200)
