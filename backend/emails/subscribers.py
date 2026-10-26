"""Mailing-list signup handling.

This module is deliberately free of any payment or Stripe reference: joining the
mailing list is independent of whether a donation or membership was ever paid.

Signing up only records intent. No provider contact is created here; the only
provider traffic from this module is the confirmation email itself, sent through
the shared mailer. The confirm step is the only caller that may create a
provider contact.
"""

import logging

from django.db import IntegrityError, transaction
from django.utils import timezone

from emails.messages import send_subscription_confirmation_email
from emails.models import CONFIRMATION_RESEND_COOLDOWN, Subscriber

logger = logging.getLogger(__name__)


def subscribe_contact(email: str, source: str) -> Subscriber:
    """Record a mailing-list signup and send the confirmation link.

    The database is the source of truth for consent, so this only records that
    someone asked to join; the row is not ``subscribed`` until the address
    confirms from its own inbox. No provider contact is created here, and the
    only provider traffic is the confirmation email itself, sent through the
    shared mailer. That is what lets an address that previously unsubscribed
    come back deliberately: confirming is the only path to ``subscribed``.

    The response the caller returns must not vary, so this returns the row and
    never raises for a known address. A repeated signup inside
    ``CONFIRMATION_RESEND_COOLDOWN`` sends nothing.

    The email is sent after the row is written, so a rollback of the enclosing
    request leaves a pending row whose mail already went out. The 48 hour token
    expiry bounds that, and consent still requires the confirm step.
    """
    normalized = email.strip().casefold()
    subscriber = _get_or_create_pending_subscriber(normalized, source)

    if _should_send_confirmation(subscriber):
        raw_token = subscriber.issue_confirmation_token()
        _send_confirmation(normalized, raw_token)

    return subscriber


def _send_confirmation(email: str, raw_token: str) -> None:
    """Send the confirmation link, never letting a failure reach the caller.

    ``send_email`` already swallows provider errors, but this is a public
    endpoint, so a failure anywhere in the mail path (a rendering error, a
    misconfigured provider, a missing template) must not become a 500 after the
    signup row has been written. Nothing is retried automatically; the link
    stays valid for 48 hours and a later signup past the cooldown issues a new
    one. The log line carries no address and no token.
    """
    try:
        send_subscription_confirmation_email(email, raw_token)
    except Exception:
        logger.error("Mailing-list confirmation email failed.")


def _should_send_confirmation(subscriber: Subscriber) -> bool:
    """Report whether this signup should send a confirmation email.

    A ``subscribed`` row is already confirmed, so it gets nothing. ``pending``
    and ``unsubscribed`` rows both get a link when they have none or when the
    cooldown has passed, which is what makes returning after an opt-out
    possible while still bounding repeat emails to one per cooldown.
    """
    if subscriber.status == Subscriber.Status.SUBSCRIBED:
        return False

    if subscriber.confirmation_sent_at is None:
        return True

    return timezone.now() - subscriber.confirmation_sent_at >= CONFIRMATION_RESEND_COOLDOWN


def _get_or_create_pending_subscriber(email: str, source: str) -> Subscriber:
    """Return the matching Subscriber, creating a pending one on first contact.

    This helper never writes to an existing row: the stored status and source
    are preserved, so an unsubscribed address is not resurrected here. The later
    ``issue_confirmation_token()`` call does write to the row (the token hash
    and its timestamps), and only that.

    Two simultaneous first signups for the same address can both miss the
    lookup, and the unique email column makes the loser raise IntegrityError.
    That is expected, so fall back to fetching the row the other request made.
    """
    try:
        with transaction.atomic():
            subscriber, created = Subscriber.objects.get_or_create(
                email=email,
                defaults={
                    "source": source,
                    "status": Subscriber.Status.PENDING,
                    "subscribed_at": timezone.now(),
                    "provider_synced": False,
                },
            )
    except IntegrityError:
        return Subscriber.objects.get(email=email)

    del created
    return subscriber
