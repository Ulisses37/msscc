import logging

from django.db import DatabaseError
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.parsers import BaseParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from emails.models import Subscriber
from emails.providers import ProviderError, get_provider
from emails.providers.resend_webhook import (
    InvalidSignatureError,
    UnconfiguredSecretError,
    parse_unsubscribe_event,
)
from emails.serializers import HONEYPOT_FIELD, SubscribeRequestSerializer
from emails.subscribers import subscribe_contact

logger = logging.getLogger(__name__)


class RawBodyParser(BaseParser):
    """Return the raw request body without consuming or re-encoding it.

    The signature covers the exact bytes Resend sent, so nothing may reformat
    them. The view reads ``request.body`` directly, which Django caches without
    running a parser at all, so this class is belt-and-braces: it keeps the
    declared parsers honest and would matter if the view ever switched to
    ``request.data``, where DRF's JSON parser would parse the stream and any
    re-serialization could change the bytes the signature was computed over.
    """

    media_type = "*/*"

    def parse(self, stream, media_type=None, parser_context=None):
        return stream.read()

# The same body for every accepted signup. A response that varied would tell a
# caller whether an address is already on the list, so keep it constant.
SUBSCRIBE_RESPONSE = {"detail": "Thanks, you're on the list."}


class AnnouncementSendView(APIView):
    """Send a mailing-list announcement through the configured email provider.

    The view renders the announcement template and hands the result to the
    provider. Templates stay free of provider-specific syntax: the adapter
    supplies the unsubscribe URL through ``UNSUBSCRIBE_URL_PLACEHOLDER``, which
    the provider replaces with a working link when the broadcast is sent.
    The admin UI for composing announcements is deferred; clients can also send
    Broadcasts from Resend's dashboard.
    """

    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        """Render the announcement, then ask the provider to broadcast it."""
        subject = str(request.data.get("subject", "")).strip()
        title = str(request.data.get("title", "")).strip() or subject
        body_html = str(request.data.get("html", ""))
        if not subject or not body_html:
            return Response(
                {"detail": "A subject and HTML body are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # One provider instance for both the footer value and the send, so a
        # different EMAIL_PROVIDER is never combined with Resend's placeholder.
        provider = get_provider()

        html = render_to_string(
            "emails/announcement.html",
            {
                "announcement_title": title,
                "announcement_body_html": body_html,
                "unsubscribe_url": provider.unsubscribe_url,
            },
        )

        try:
            provider.send_broadcast(subject=subject, html=html)
        except ProviderError as exc:
            # The response stays generic, but the cause has to reach the log or
            # a failure like an unverified sending domain is undiagnosable.
            logger.error("Announcement broadcast failed: %s", exc.__cause__ or exc)
            return Response(
                {"detail": "The announcement could not be sent."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({"detail": "Announcement sent."}, status=status.HTTP_200_OK)


class ResendWebhookView(APIView):
    """Receive Resend's unsubscribe notifications and sync our own records.

    Unauthenticated because Resend calls it; the Svix signature is what proves a
    delivery is genuine. This only mirrors Resend's state into our database:
    Resend owns the opt-out flow and the preference page, so nothing here sends
    anything back or flips a row back to subscribed.
    """

    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    parser_classes = [RawBodyParser]

    def post(self, request):
        """Verify the delivery, then record the unsubscribe if there is a row."""
        try:
            email = parse_unsubscribe_event(
                request.body,
                {
                    "svix-id": request.headers.get("svix-id", ""),
                    "svix-timestamp": request.headers.get("svix-timestamp", ""),
                    "svix-signature": request.headers.get("svix-signature", ""),
                },
            )
        except UnconfiguredSecretError:
            return Response(
                {"detail": "Webhook processing is temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except InvalidSignatureError:
            # Generic body: never echo the signature, the secret, or the error.
            return Response(
                {"detail": "Invalid webhook signature."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if email is None:
            # Acknowledged so Resend stops retrying an event we do not care about.
            return Response({"received": True}, status=status.HTTP_200_OK)

        try:
            updated = _mark_subscriber_unsubscribed(email)
        except DatabaseError:
            logger.error("Database error while recording a mailing-list unsubscribe.")
            return Response(
                {"detail": "Webhook processing is temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if not updated:
            # Unknown address, or a row that is already unsubscribed. Either way
            # this is a no-op, so a redelivery changes nothing.
            logger.info("Resend unsubscribe did not match a subscribed row.")

        return Response({"received": True}, status=status.HTTP_200_OK)


def _mark_subscriber_unsubscribed(email: str) -> bool:
    """Unsubscribe the matching subscriber, returning whether anything changed.

    The filter requires ``status=subscribed``, so a second delivery of the same
    event matches nothing and ``unsubscribed_at`` keeps its original value.
    """
    return Subscriber.objects.filter(
        email=email,
        status=Subscriber.Status.SUBSCRIBED,
    ).update(
        status=Subscriber.Status.UNSUBSCRIBED,
        unsubscribed_at=timezone.now(),
        provider_synced=True,
    ) == 1


class SubscribeView(APIView):
    """Add an address to the mailing list from any public entry point.

    Unauthenticated by design, so it is reachable by anyone. A per-IP rate limit
    and a honeypot are the defenses. The response body and status are identical
    for every accepted signup, so the endpoint cannot be used to check whether an
    address is already subscribed.

    This records intent only. No provider contact is created here; the address
    must confirm from its own inbox before it is ``subscribed``.
    """

    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "email_subscribe"

    def post(self, request):
        """Validate the signup, then hand it to the shared service."""
        serializer = SubscribeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if data.get(HONEYPOT_FIELD):
            # A bot filled a field no human can see. Skip the work, but answer
            # exactly as a real signup so the bot cannot tell it was filtered.
            logger.warning("Mailing-list signup discarded by the honeypot.")
            return Response(SUBSCRIBE_RESPONSE, status=status.HTTP_200_OK)

        try:
            subscribe_contact(data["email"], data["source"])
        except DatabaseError:
            logger.error("Database error while recording a mailing-list signup.")
            return Response(
                {"detail": "Unable to join the mailing list at this time."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(SUBSCRIBE_RESPONSE, status=status.HTTP_200_OK)
