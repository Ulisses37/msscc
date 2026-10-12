from rest_framework import serializers

from emails.models import Subscriber

# Field name for the hidden input that only a bot fills in. Kept here so the
# view and the frontend component cannot disagree about it.
HONEYPOT_FIELD = "website"


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
