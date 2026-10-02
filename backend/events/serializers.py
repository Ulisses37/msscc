from rest_framework import serializers

from events.models import Event, EventImage, VolunteerSignup, VolunteerSlot


# serializer allows for easier access to event metadata
class EventSerializer(serializers.ModelSerializer):
    """Serializer for event records."""

    class Meta:
        model = Event
        fields = [
            "event_id",
            "title_en",
            "title_ja",
            "description_en",
            "description_ja",
            "location_en",
            "location_ja",
            "start_datetime",
            "end_datetime",
            "volunteer_slots",
            "is_published",
            "send_volunteer_reminders",
            "reminder_sent_at",
            "created_at",
            "updated_at",
            "media_asset",
            "calendar_link",
        ]


class EventImageSerializer(serializers.ModelSerializer):
    """Serialize an additional event image and its directly usable media URL."""

    media_url = serializers.SerializerMethodField()

    def get_media_url(self, obj: EventImage) -> str | None:
        """Return the associated media file URL when the asset still exists."""
        if obj.media_asset and obj.media_asset.file:
            return obj.media_asset.file.url

        return None

    class Meta:
        model = EventImage
        fields = [
            "event_image_id",
            "event",
            "media_asset",
            "media_url",
            "caption_en",
            "caption_ja",
            "display_order",
            "image_width",
            "image_alignment",
        ]
        read_only_fields = ["event_image_id", "media_url"]


class VolunteerSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = VolunteerSlot
        fields = "__all__"


class VolunteerSignupSerializer(serializers.ModelSerializer):
    slot_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = VolunteerSignup
        fields = [
            "volunteer_signup_id",
            "slot",
            "slot_id",
            "first_name",
            "last_name",
            "email",
            "phone",
            "status",
            "submitted_at",
        ]
        read_only_fields = ["volunteer_signup_id", "submitted_at"]
