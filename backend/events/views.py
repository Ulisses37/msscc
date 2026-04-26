from rest_framework import generics

from events.models import Event
from events.serializers import EventSerializer


class EventListView(generics.ListAPIView):
    """Return event records as a JSON list."""

    queryset = Event.objects.all().order_by("start_datetime", "event_id")
    serializer_class = EventSerializer


class EventDetailView(generics.RetrieveUpdateAPIView):
    """Retrieve or update a single event."""

    queryset = Event.objects.all()
    serializer_class = EventSerializer
    lookup_field = "event_id"
