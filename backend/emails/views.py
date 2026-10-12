import logging

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from emails.providers import ProviderError, get_provider

logger = logging.getLogger(__name__)


class AnnouncementSendView(APIView):
    """Send a mailing-list announcement through the configured email provider.

    The caller supplies the finished HTML body, so this view stays free of any
    template or provider-specific knowledge. The admin UI for composing
    announcements is deferred; clients can also send Broadcasts from Resend's
    dashboard.
    """

    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        """Forward the submitted subject and HTML to the provider."""
        subject = str(request.data.get("subject", "")).strip()
        html = str(request.data.get("html", ""))
        if not subject or not html:
            return Response(
                {"detail": "A subject and HTML body are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            get_provider().send_broadcast(subject=subject, html=html)
        except ProviderError:
            # Never return provider or SDK error text to the client.
            logger.error("Announcement broadcast failed.")
            return Response(
                {"detail": "The announcement could not be sent."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({"detail": "Announcement sent."}, status=status.HTTP_200_OK)
