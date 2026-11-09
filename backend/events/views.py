import logging

from django.conf import settings
from django.core.management import call_command
from django.db import transaction
from django.db.models import QuerySet
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_POST
from rest_framework import generics, permissions, status, viewsets
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from emails.messages import send_volunteer_thanks_email
from events.models import Event, EventImage, VolunteerSignup, VolunteerSlot
from events.permissions import HasEventsPermission
from events.serializers import (
    EventCreateSerializer,
    EventImageSerializer,
    EventSerializer,
    VolunteerCancellationDetailSerializer,
    VolunteerSignupSerializer,
    VolunteerSlotSerializer,
)
from events.services import announce_event_to_mailing_list
from events.throttles import VolunteerSignupThrottle

logger = logging.getLogger(__name__)

SHIFT_FULL_MESSAGE = "This shift is full."
SHIFT_FULL_CODE = "shift_full"


def create_signup_under_lock(serializer, *, allow_over_capacity=False):
    """Save a validated signup while holding a lock on its shift."""
    slot = serializer.validated_data.get("slot")
    slot_id = serializer.validated_data.get("slot_id") or (slot.pk if slot else None)

    with transaction.atomic():
        if slot_id is not None:
            # Serialize signups for this shift so the next request sees the prior
            # request's committed signup before checking capacity.
            locked_slot = VolunteerSlot.objects.select_for_update().get(pk=slot_id)

            # Recheck here because simultaneous duplicate requests can both pass
            # serializer validation before either one saves.
            serializer.validate(serializer.validated_data)

            if not allow_over_capacity:
                taken = VolunteerSignup.objects.filter(
                    slot=locked_slot,
                    status="approved",
                ).count()
                if taken >= locked_slot.capacity:
                    raise ValidationError(
                        {"slot_id": [SHIFT_FULL_MESSAGE], "code": [SHIFT_FULL_CODE]}
                    )

        signup = serializer.save(status="approved")

    # Provider latency must not hold the shift-row lock.
    if signup.slot is not None:
        send_volunteer_thanks_email(signup)

    return signup


class EventListView(generics.ListCreateAPIView):
    """Return event records as a JSON list."""

    queryset = Event.objects.all().order_by("start_datetime", "event_id").prefetch_related("slots")
    serializer_class = EventSerializer

    def get_serializer_class(self):
        """Accept the announce option on create only, never on a plain list read."""
        if self.request.method == "POST":
            return EventCreateSerializer
        return EventSerializer

    def perform_create(self, serializer):
        """Create the event, then queue an announcement if the request asked for one.

        The flag is read from ``validated_data`` before ``save()`` because
        ``EventCreateSerializer.create()`` pops it: once create runs, the value is
        gone from the data. The announcement itself is scheduled with
        ``transaction.on_commit`` so it runs after the event is committed, and a
        provider outage can never roll the event back.
        """
        announce = serializer.validated_data.get("announce_to_mailing_list", False)
        event = serializer.save()

        if not announce:
            return

        # The events API has no permission_classes, and DRF's default is
        # AllowAny, so this endpoint is reachable anonymously. Only a logged-in
        # admin may make the server mail the whole list; anyone else is ignored.
        if not self.request.user.is_authenticated:
            logger.warning(
                "Ignoring announce_to_mailing_list from an unauthenticated caller."
            )
            return

        if not settings.EVENT_ANNOUNCEMENTS_ENABLED:
            logger.warning(
                "Ignoring announce_to_mailing_list while "
                "EVENT_ANNOUNCEMENTS_ENABLED is off."
            )
            return

        # The public cannot see an unpublished event yet, and the detail page
        # would show its not-found state, so there is nothing to announce.
        if not event.is_published:
            logger.warning(
                "Ignoring announce_to_mailing_list for unpublished event %s.",
                event.event_id,
            )
            return

        transaction.on_commit(lambda: announce_event_to_mailing_list(event))


class EventDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve or update a single event."""

    queryset = Event.objects.prefetch_related("slots")
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

    def get_throttles(self):
        """Limit public signup creation without limiting management actions."""
        if self.action == "create":
            return [VolunteerSignupThrottle()]
        return super().get_throttles()

    def create(self, request, *args, **kwargs):
        """Return a success response without saving a bot-filled signup form."""
        # Honeypot: people never see this field, so a filled value means a bot.
        # Answer like a success so the bot does not learn it was caught, but save
        # nothing and send no email.
        if str(request.data.get("website", "")).strip():
            return Response(
                {
                    "volunteer_signup_id": 0,
                    "first_name": request.data.get("first_name", ""),
                    "last_name": request.data.get("last_name", ""),
                    "email": request.data.get("email", ""),
                    "phone": request.data.get("phone", ""),
                },
                status=status.HTTP_201_CREATED,
            )

        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        """Create a public signup without allowing capacity to be exceeded."""
        create_signup_under_lock(serializer)


class AdminVolunteerSignupCreateView(generics.CreateAPIView):
    """Let authorized admins add volunteers to a full shift when necessary."""

    serializer_class = VolunteerSignupSerializer
    permission_classes = [HasEventsPermission]

    def perform_create(self, serializer):
        """Create an admin-entered signup while retaining duplicate protection."""
        create_signup_under_lock(serializer, allow_over_capacity=True)


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
