"""Mailing-list signup handling.

This module is deliberately free of any payment or Stripe reference: joining the
mailing list is independent of whether a donation or membership was ever paid.
"""

import logging

from django.db import IntegrityError, transaction
from django.utils import timezone

from emails.models import Subscriber
from emails.providers import get_provider
from emails.providers.base import ContactState

logger = logging.getLogger(__name__)


def subscribe_contact(email: str, source: str) -> Subscriber:
    """Record a mailing-list opt-in and mirror it to the email provider.

    The database is the source of truth, so a saved row is the successful
    outcome even when the provider is unavailable. An address that previously
    unsubscribed is left untouched: this function is reached from a public
    endpoint, so anyone could otherwise re-subscribe someone who opted out. A
    real re-subscribe needs double opt-in and is out of scope.
    """
    normalized = email.strip().casefold()
    subscriber = _get_or_create_subscriber(normalized, source)

    if subscriber.status == Subscriber.Status.UNSUBSCRIBED:
        # Never overwrite a recorded opt-out, and never touch the provider.
        logger.info("Mailing-list signup ignored for an unsubscribed address.")
        return subscriber

    if subscriber.provider_synced:
        # Already mirrored. Skipping the provider call keeps repeated public
        # signups from consuming Resend's API quota.
        return subscriber

    state = _sync_to_provider(normalized)
    if state is ContactState.UNSUBSCRIBED:
        # The provider holds an opt-out our database did not know about. Record
        # it here too rather than overwriting it. Under-sending is the safe
        # direction, and the source of this state is the provider, not us.
        _mark_unsubscribed(normalized)
        subscriber.refresh_from_db()
    return subscriber


def _mark_unsubscribed(email: str) -> None:
    """Mirror a provider-side opt-out into our own row."""
    # unsubscribed_at is when we noticed, not when the contact actually opted
    # out; the provider does not tell us the original time.
    Subscriber.objects.filter(email=email).update(
        status=Subscriber.Status.UNSUBSCRIBED,
        unsubscribed_at=timezone.now(),
        provider_synced=True,
    )


def _get_or_create_subscriber(email: str, source: str) -> Subscriber:
    """Return the matching Subscriber, creating it only on a first opt-in.

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
                    "status": Subscriber.Status.SUBSCRIBED,
                    "subscribed_at": timezone.now(),
                    "provider_synced": False,
                },
            )
    except IntegrityError:
        return Subscriber.objects.get(email=email)

    del created
    return subscriber


def _sync_to_provider(email: str) -> ContactState | None:
    """Push the address to the provider mirror and record the outcome.

    Returns the state the provider reported, or ``None`` when the provider could
    not be reached. Failures are logged and swallowed: ProviderError covers
    provider outages, and the broad catch also covers a misconfigured
    EMAIL_PROVIDER or an adapter construction failure, none of which should turn
    a saved signup into an error response. The row keeps
    ``provider_synced=False`` for a later retry.
    """
    try:
        state = get_provider().upsert_contact(email)
    except Exception:
        # Deliberately no email address and no provider text in the log.
        logger.error("Mailing-list provider sync failed.")
        return None

    if state is ContactState.UNSUBSCRIBED:
        return state

    # Any outcome other than a known opt-out counts as synced.
    Subscriber.objects.filter(email=email).update(provider_synced=True)
    return state
