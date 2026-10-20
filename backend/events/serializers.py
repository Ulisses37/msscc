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
            "thumbnail_crop_x",
            "thumbnail_crop_y",
            "thumbnail_crop_width",
            "thumbnail_crop_height",
        ]

    def validate(self, attrs: dict) -> dict:
        """Reject a thumbnail crop that extends past the edge of the image."""
        crop_defaults = {
            "thumbnail_crop_x": 0,
            "thumbnail_crop_y": 0,
            "thumbnail_crop_width": 100,
            "thumbnail_crop_height": 100,
        }

        # Leave other updates alone unless they touch the crop.
        if not any(field in attrs for field in crop_defaults):
            return attrs

        # On a partial update, fields that weren't sent keep their saved values.
        crop = {}
        for field, default in crop_defaults.items():
            if field in attrs:
                crop[field] = attrs[field]
            elif self.instance is not None:
                crop[field] = getattr(self.instance, field)
            else:
                crop[field] = default

        # A small tolerance covers rounding in the values the picker sends.
        if crop["thumbnail_crop_x"] + crop["thumbnail_crop_width"] > 100.01:
            raise serializers.ValidationError(
                {"thumbnail_crop_width": "The crop cannot extend past the "
                "right edge of the image."}
            )
        if crop["thumbnail_crop_y"] + crop["thumbnail_crop_height"] > 100.01:
            raise serializers.ValidationError(
                {"thumbnail_crop_height": "The crop cannot extend past the bottom "
                "edge of the image."}
            )

        return attrs


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
        read_only_fields = ["volunteer_signup_id", "status", "submitted_at"]


class VolunteerCancellationDetailSerializer(serializers.ModelSerializer):
    """Serialize public details shown before a volunteer confirms cancellation."""

    event_title_en = serializers.CharField(source="slot.event.title_en", read_only=True)
    event_title_ja = serializers.CharField(source="slot.event.title_ja", read_only=True)
    slot_start_datetime = serializers.DateTimeField(source="slot.start_datetime", read_only=True)
    slot_end_datetime = serializers.DateTimeField(source="slot.end_datetime", read_only=True)
    role = serializers.CharField(source="slot.position_name", read_only=True)

    class Meta:
        model = VolunteerSignup
        fields = [
            "first_name",
            "last_name",
            "event_title_en",
            "event_title_ja",
            "slot_start_datetime",
            "slot_end_datetime",
            "role",
        ]
