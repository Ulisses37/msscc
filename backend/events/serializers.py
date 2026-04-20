from rest_framework import serializers

from events.models import Event


# serializer allows for easier access to event metadata
class EventSerializer(serializers.ModelSerializer):
    """Serializer for event records."""

    class Meta:
        model = Event
        fields = [
            "event_id",
            "title",
            "description",
            "location",
            "start_datetime",
            "end_datetime",
            "volunteer_slots",
            "is_published",
            "created_at",
            "updated_at",
            "media_asset",
            "calendar_link",
        ]
