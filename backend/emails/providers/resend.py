"""Resend implementation of the email provider interface.

This is the only module in the project allowed to import the Resend SDK. Every
other module reaches the provider through ``emails.providers.get_provider()``.
"""

import logging

import resend
from django.conf import settings

from emails.providers.base import ContactState, EmailProvider, ProviderError

logger = logging.getLogger(__name__)

# Resend replaces this placeholder with a working, per-recipient unsubscribe URL
# when a Broadcast is sent. Resend does not add an unsubscribe link on its own,
# and CAN-SPAM requires one, so the announcement template must always render it.
#
# UNVERIFIED: we have no verified sending domain yet, so a Broadcast cannot be
# sent from this project's Resend account and the substitution has never been
# observed end to end. Confirm it on the first real broadcast.
UNSUBSCRIBE_URL_PLACEHOLDER = "{{{RESEND_UNSUBSCRIBE_URL}}}"


class ResendProvider(EmailProvider):
    """Email provider backed by Resend's Emails, Contacts, and Broadcasts APIs."""

    def __init__(self) -> None:
        # Resend reads the key from the module-level attribute on every call.
        resend.api_key = settings.RESEND_API_KEY
        # The SDK default is 30 seconds. A single signup can make two calls
        # (lookup, then create), so keep each one short rather than letting a
        # stalled provider hold the request for a minute.
        resend.default_http_client = resend.RequestsClient(timeout=10)

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

    @property
    def unsubscribe_url(self) -> str:
        """Return the placeholder Resend substitutes at send time."""
        return UNSUBSCRIBE_URL_PLACEHOLDER

    def upsert_contact(self, email: str) -> ContactState:
        """Create the contact in the announcement segment, or report an opt-out.

        The lookup is a guard only: reading the contact first means a
        provider-side unsubscribe is never overwritten. Resend's create is a
        silent upsert for an address that already exists, so the create is the
        same call whether the contact is new or already present, and a contact
        already unsubscribed is left exactly as it is.
        """
        self._require_segment_id()

        if self._is_unsubscribed(email):
            logger.info("Resend contact is unsubscribed; leaving it untouched.")
            return ContactState.UNSUBSCRIBED

        # The lookup and this create are not atomic, so an unsubscribe landing
        # between them would be overwritten. That window is accepted: it is
        # small, and the alternative (skipping create for known links) would
        # also skip contacts that were never in the segment.
        self._call(
            resend.Contacts.create,
            {"email": email, "segments": [{"id": settings.RESEND_SEGMENT_ID}]},
        )
        return ContactState.SUBSCRIBED

    def remove_contact(self, email: str) -> None:
        """Remove the contact from the announcement segment.

        This removes segment membership rather than deleting the contact. Our
        database is the source of truth for consent and Resend is a mirror, so
        the mirror operation stays non-destructive: a global delete would also
        discard the contact's properties and any other segment memberships.
        """
        self._require_segment_id()
        self._call(resend.Contacts.Segments.remove, self._segment_params(email))

    def reactivate_contact(self, email: str) -> ContactState:
        """Create or refresh the contact, clearing any provider-side opt-out.

        Called only by the confirm step, where the address has just proved
        control of its own inbox. Order matters: a first-time subscriber has no
        Resend contact yet, so ``update`` alone would fail before the contact
        existed. ``create`` runs first and attaches the segment using the same
        payload ``upsert_contact`` has always used; ``update`` then clears the
        ``unsubscribed`` flag.

        A ``create`` failure does not end the operation: whether Resend's create
        upserts or errors on an address that already exists is unverified, so
        both outcomes fall through to ``update``, which is what carries the
        reactivation. Only an ``update`` failure becomes a ``ProviderError``.

        UNVERIFIED against the live API, to confirm in the Resend dashboard:
        create on an existing email, update on an unknown email, and whether
        update with ``unsubscribed`` false restores segment membership.
        """
        self._require_segment_id()
        try:
            self._call(
                resend.Contacts.create,
                {"email": email, "segments": [{"id": settings.RESEND_SEGMENT_ID}]},
            )
        except ProviderError:
            # Upsert and hard-error are both possible here, so the failure is
            # only informational: the update below is authoritative. The log
            # line carries no address.
            logger.warning("Resend contact create failed during reactivation.")

        self._call(resend.Contacts.update, {"email": email, "unsubscribed": False})
        return ContactState.SUBSCRIBED

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
    def _is_unsubscribed(email: str) -> bool:
        """Report whether Resend already holds an opt-out for this address.

        ``Contacts.get`` raises a ``ResendError`` with an integer ``code`` of 404
        when the address is unknown, which is not an error for us: the caller
        simply creates it. Any other failure is a real problem and becomes a
        ``ProviderError`` so the caller can retry later.
        """
        try:
            contact = resend.Contacts.get(email=email)
        except resend.exceptions.ResendError as exc:
            if exc.code == 404:
                return False
            raise ProviderError("Resend request failed.") from exc
        except Exception as exc:
            raise ProviderError("Resend request failed.") from exc

        # Resend returns a dict-like payload; the flag is a key, not an attribute.
        return bool(contact.get("unsubscribed"))

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
