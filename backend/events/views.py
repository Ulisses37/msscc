from rest_framework import generics

from rest_framework import viewsets

from events.models import Event, VolunteerSignup, VolunteerSlot
from events.serializers import (
    EventSerializer,
    VolunteerSignupSerializer,
    VolunteerSlotSerializer,
)


class EventListView(generics.ListAPIView):
    """Return event records as a JSON list."""

    queryset = Event.objects.all().order_by("start_datetime", "event_id")
    serializer_class = EventSerializer


class EventDetailView(generics.RetrieveUpdateAPIView):
    """Retrieve or update a single event."""

    queryset = Event.objects.all()
    serializer_class = EventSerializer
    lookup_field = "event_id"


class VolunteerSlotViewSet(viewsets.ModelViewSet):
    queryset = VolunteerSlot.objects.all()
    serializer_class = VolunteerSlotSerializer


class VolunteerSignupViewSet(viewsets.ModelViewSet):
    queryset = VolunteerSignup.objects.all().order_by("-submitted_at")
    serializer_class = VolunteerSignupSerializer
