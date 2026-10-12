"""Resend implementation of the email provider interface.

This is the only module in the project allowed to import the Resend SDK. Every
other module reaches the provider through ``emails.providers.get_provider()``.
"""

import logging

import resend
from django.conf import settings

from emails.providers.base import EmailProvider, ProviderError

logger = logging.getLogger(__name__)

# Resend replaces this placeholder with a working, per-recipient unsubscribe URL
# when a Broadcast is sent. Resend does not add an unsubscribe link on its own,
# and CAN-SPAM requires one, so the announcement template must always render it.
UNSUBSCRIBE_URL_PLACEHOLDER = "{{{RESEND_UNSUBSCRIBE_URL}}}"


class ResendProvider(EmailProvider):
    """Email provider backed by Resend's Emails, Contacts, and Broadcasts APIs."""

    def __init__(self) -> None:
        # Resend reads the key from the module-level attribute on every call.
        resend.api_key = settings.RESEND_API_KEY

    def send_email(self, *, to: str, subject: str, html: str) -> None:
        """Send a transactional email through Resend."""
        self._call(
            resend.Emails.send,
            {
                "from": settings.RESEND_FROM_EMAIL,
                "to": to,
                "subject": subject,
                "html": html,
            },
        )

    def upsert_contact(self, email: str) -> None:
        """Create the contact and add it to the announcement segment.

        Resend may reject a create for an address that already exists, so a
        failed create falls back to adding the segment directly, which keeps the
        whole call idempotent either way.
        """
        self._require_segment_id()
        try:
            self._call(
                resend.Contacts.create,
                {"email": email, "segments": [{"id": settings.RESEND_SEGMENT_ID}]},
            )
        except ProviderError:
            # The address may already exist, so a duplicate create is expected.
            # The segment add below is itself idempotent.
            logger.info("Contact may already exist in Resend; ensuring segment membership.")
            self._call(resend.Contacts.Segments.add, self._segment_params(email))

    def remove_contact(self, email: str) -> None:
        """Remove the contact from the announcement segment.

        This removes segment membership rather than deleting the contact. Our
        database is the source of truth for consent and Resend is a mirror, so
        the mirror operation stays non-destructive: a global delete would also
        discard the contact's properties and any other segment memberships.
        """
        self._require_segment_id()
        self._call(resend.Contacts.Segments.remove, self._segment_params(email))

    def send_broadcast(self, *, subject: str, html: str) -> None:
        """Send a marketing email to the configured segment immediately."""
        self._require_segment_id()
        self._call(
            resend.Broadcasts.create,
            {
                "segment_id": settings.RESEND_SEGMENT_ID,
                "from": settings.RESEND_FROM_EMAIL,
                "subject": subject,
                "html": html,
                "send": True,
            },
        )

    @staticmethod
    def _require_segment_id() -> None:
        """Fail before making a request that cannot possibly succeed.

        Every mailing-list operation is scoped to a segment. Without the ID the
        SDK would build a request against an empty segment path, so surface the
        configuration problem instead of sending it.
        """
        if not settings.RESEND_SEGMENT_ID:
            logger.error("RESEND_SEGMENT_ID is not configured.")
            raise ProviderError("The mailing-list segment is not configured.")

    @staticmethod
    def _segment_params(email: str) -> dict:
        """Return the contact-segment parameters shared by add and remove."""
        return {"segment_id": settings.RESEND_SEGMENT_ID, "email": email}

    @staticmethod
    def _call(operation, params: dict) -> None:
        """Run an SDK call and convert any failure into a ProviderError.

        The SDK raises its own exception types plus ``ValueError`` for bad
        arguments. Callers must never see provider internals, so everything is
        reduced to one exception type.
        """
        try:
            operation(params)
        except Exception as exc:
            raise ProviderError("Resend request failed.") from exc
