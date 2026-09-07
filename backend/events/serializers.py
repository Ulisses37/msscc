from rest_framework import serializers

from events.models import Event, VolunteerSignup, VolunteerSlot


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
            "created_at",
            "updated_at",
            "media_asset",
            "calendar_link",
        ]


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
