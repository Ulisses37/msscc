"""Resend-specific webhook handling.

Resend signs webhook deliveries with Svix headers, so the verification and event
parsing stay behind this module. Nothing outside the ``providers`` package may
import it, which keeps the Resend SDK and Resend event names out of the views.

UNVERIFIED: the payload shape below (``type``, ``data.email``,
``data.unsubscribed``) comes from Resend's documentation only. Nobody has
observed a real signed delivery yet, because that needs a reachable public URL.
Whether clicking a Broadcast's unsubscribe link fires ``contact.updated`` is
likewise unobserved.
"""

import logging

import resend
from django.conf import settings

logger = logging.getLogger(__name__)

# Events we act on. ``contact.deleted`` is included because a contact removed in
# Resend is effectively an opt-out, and ignoring it would leave a row that still
# claims ``provider_synced`` while Resend no longer holds the contact.
UNSUBSCRIBE_EVENTS = frozenset({"contact.updated", "contact.deleted"})


class InvalidSignatureError(Exception):
    """Raised when a delivery cannot be proven to come from Resend."""


class UnconfiguredSecretError(Exception):
    """Raised when no webhook signing secret is configured."""


def parse_unsubscribe_event(raw_body: bytes, headers: dict) -> str | None:
    """Verify a delivery and return the email it unsubscribes, or ``None``.

    Returns ``None`` for any event we do not act on, including
    ``contact.updated`` with ``unsubscribed`` false. Our own ``Contacts.create``
    and ``Segments.remove`` calls emit that event too, so acting on it would let
    a routine signup flip a row back to subscribed.
    """
    secret = settings.RESEND_WEBHOOK_SECRET
    if not secret:
        # Fail closed: an unset secret must never mean "accept anything".
        logger.error("RESEND_WEBHOOK_SECRET is not configured.")
        raise UnconfiguredSecretError

    try:
        payload = resend.Webhooks.verify(
            {
                "payload": raw_body.decode("utf-8"),
                "headers": {
                    "id": headers.get("svix-id", ""),
                    "timestamp": headers.get("svix-timestamp", ""),
                    "signature": headers.get("svix-signature", ""),
                },
                "webhook_secret": secret,
            }
        )
    except Exception as exc:
        # Covers a ValueError for a bad or stale signature, plus anything else
        # the SDK raises. The caller answers 400; the text is logged only.
        logger.warning("Resend webhook signature check failed: %s", type(exc).__name__)
        raise InvalidSignatureError from exc

    event_type = payload.get("type")
    if event_type not in UNSUBSCRIBE_EVENTS:
        logger.info("Ignoring resend webhook event type %s.", event_type)
        return None

    if event_type == "contact.deleted":
        return _email_from(payload)

    data = payload.get("data") or {}
    if data.get("unsubscribed") is not True:
        # A create or re-add reports unsubscribed false. Never a reason to
        # unsubscribe anyone, and never a reason to re-subscribe them.
        logger.info("Ignoring resend webhook event type %s.", event_type)
        return None

    return _email_from(payload)


def _email_from(payload: dict) -> str | None:
    """Return the normalized contact email, or ``None`` when it is unusable."""
    data = payload.get("data") or {}
    email = data.get("email")
    if not isinstance(email, str) or not email.strip():
        # Log without the value: it may be absent, malformed, or attacker-shaped.
        logger.info("Resend webhook event has no usable contact email.")
        return None

    return email.strip().casefold()
