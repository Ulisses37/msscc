from django.conf import settings
from django.core.management import call_command
from django.db.models import QuerySet
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_POST
from rest_framework import generics, permissions, viewsets
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from emails.messages import send_volunteer_thanks_email
from events.models import Event, EventImage, VolunteerSignup, VolunteerSlot
from events.serializers import (
    EventImageSerializer,
    EventSerializer,
    VolunteerCancellationDetailSerializer,
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


class EventImageViewSet(viewsets.ModelViewSet):
    """Create and manage additional images associated with events."""

    serializer_class = EventImageSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self) -> QuerySet[EventImage]:
        """Return event images in display order, optionally for one event."""
        queryset = EventImage.objects.select_related("event", "media_asset")
        event_id = self.request.query_params.get("event_id")

        if event_id:
            queryset = queryset.filter(event_id=event_id)

        return queryset.order_by("display_order", "event_image_id")


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
    serializer_class = VolunteerSignupSerializer

    # filter slot IDs properly
    def get_queryset(self):
        queryset = VolunteerSignup.objects.all().order_by("-submitted_at")
        slot_id = self.request.query_params.get("slot_id")

        if slot_id:
            queryset = queryset.filter(slot_id=slot_id)

        return queryset

    def perform_create(self, serializer):
        signup = serializer.save(status="approved")
        if signup.slot is not None:
            send_volunteer_thanks_email(signup)


class VolunteerCancellationLookupView(APIView):
    """Return public signup details for a valid, unexpired cancellation link."""

    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        """Return signup details without changing the signup's state."""
        signup = self.get_active_signup(token)

        return Response(VolunteerCancellationDetailSerializer(signup).data)

    def delete(self, request, token):
        """Delete the signup associated with a valid cancellation link."""
        signup = self.get_active_signup(token)
        signup.delete()

        return Response(status=204)

    def get_active_signup(self, token):
        """Return a signup only when its cancellation link is still valid."""
        try:
            signup = VolunteerSignup.objects.select_related("slot__event").get(
                cancellation_token=token,
            )
        except VolunteerSignup.DoesNotExist as exc:
            raise NotFound() from exc

        if signup.slot is None or signup.slot.start_datetime <= timezone.now():
            raise NotFound()

        return signup


@require_POST
def run_event_reminders(request):
    """Scheduled trigger for the volunteer reminder emails.

    External schedulers (e.g. a Railway cron job or CI task) POST to this
    endpoint to run the ``send_event_reminders`` management command on schedule.
    The request must include the shared secret in the ``X-API-Key`` header,
    matching the ``TRIGGER_API_KEY`` setting.
    """
    api_key = request.headers.get("X-API-Key", "")
    if api_key != settings.TRIGGER_API_KEY:
        return JsonResponse(
            {"error": "Unauthorized"},
            status=403,
        )

    call_command("send_event_reminders")
    return JsonResponse({"status": "ok"})
