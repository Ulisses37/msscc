import logging

from django.db import DatabaseError
from django.template.loader import render_to_string
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from emails.providers import ProviderError, get_provider
from emails.serializers import HONEYPOT_FIELD, SubscribeRequestSerializer
from emails.subscribers import subscribe_contact

logger = logging.getLogger(__name__)

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


class SubscribeView(APIView):
    """Add an address to the mailing list from any public entry point.

    Unauthenticated by design, so it is reachable by anyone. A per-IP rate limit
    and a honeypot are the defenses, and the response never varies so it cannot
    be used to check whether an address is already subscribed.
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
