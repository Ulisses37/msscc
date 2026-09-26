from rest_framework import generics

from rest_framework import viewsets

from emails.messages import send_volunteer_thanks_email
from events.models import Event, VolunteerSignup, VolunteerSlot
from events.serializers import (
    EventSerializer,
    VolunteerSignupSerializer,
    VolunteerSlotSerializer,
)


class EventListView(generics.ListCreateAPIView):
    """Return event records as a JSON list."""

    queryset = Event.objects.all().order_by("start_datetime", "event_id")
    serializer_class = EventSerializer


class EventDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve or update a single event."""

    queryset = Event.objects.all()
    serializer_class = EventSerializer
    lookup_field = "event_id"


class VolunteerSlotViewSet(viewsets.ModelViewSet):
    serializer_class = VolunteerSlotSerializer

    def get_queryset(self):
        queryset = VolunteerSlot.objects.all()
        event_id = self.request.query_params.get("event_id")
        event = self.request.query_params.get("event")

        if event_id:
            queryset = queryset.filter(event_id=event_id)
        elif event:
            queryset = queryset.filter(event_id=event)

        return queryset.order_by("start_datetime", "volunteer_slot_id")


class VolunteerSignupViewSet(viewsets.ModelViewSet):
    queryset = VolunteerSignup.objects.all().order_by("-submitted_at")
    serializer_class = VolunteerSignupSerializer

    def perform_create(self, serializer):
        signup = serializer.save()
        if signup.slot is not None:
            send_volunteer_thanks_email(signup)
