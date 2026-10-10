"""Membership checkout persistence; activation belongs to verified webhooks."""

from calendar import monthrange
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import stripe
from django.db import DatabaseError, IntegrityError, transaction
from django.utils import timezone

from donations.models import Membership
from payments.serializers import MEMBERSHIP_PRICES
from payments.services.stripe_service import (
    cancel_membership_payment_intent,
    create_membership_payment_intent,
)


def _annual_renewal_date(start: date) -> date:
    """Return the next anniversary; February 29 renews on February 28."""
    year = start.year + 1
    return start.replace(year=year, day=min(start.day, monthrange(year, start.month)[1]))


def update_membership_from_payment_intent(
    *, reference, intent_id, event_type, intent, event_created
):
    """Apply a verified PaymentIntent event to its checkout row once."""
    status_by_event = {
        "payment_intent.succeeded": Membership.PaymentStatus.COMPLETED,
        "payment_intent.payment_failed": Membership.PaymentStatus.FAILED,
        "payment_intent.canceled": Membership.PaymentStatus.CANCELED,
    }
    if event_type not in status_by_event:
        raise ValueError("Unsupported membership payment event.")

    with transaction.atomic():
        # Both keys must identify the same checkout; the unique reference is
        # locked so concurrent deliveries cannot each activate the member.
        membership = Membership.objects.select_for_update().get(
            checkout_reference=reference, stripe_payment_intent_id=intent_id
        )
        target = status_by_event[event_type]
        if membership.payment_status == Membership.PaymentStatus.COMPLETED:
            return False
        if target == Membership.PaymentStatus.COMPLETED:
            # Stripe's amount_received is cents actually collected, not the
            # requested amount. Reject missing/boolean/incorrect values.
            received = intent.get("amount_received")
            if (
                intent.get("status") != "succeeded"
                or not isinstance(received, int)
                or isinstance(received, bool)
                or membership.expected_amount is None
                or received != membership.expected_amount * Decimal(100)
                or intent.get("currency") != membership.currency
            ):
                return False
            # Stripe event.created is Unix seconds; delivery/retries may occur
            # days later. Never begin the paid year on the processing date.
            if (not isinstance(event_created, int) or isinstance(event_created, bool)
                    or event_created <= 0):
                return False
            try:
                start = timezone.localtime(
                    datetime.fromtimestamp(event_created, tz=UTC)
                ).date()
            except (OverflowError, OSError, ValueError):
                return False
            renewal = _annual_renewal_date(start)
            membership.payment_status = target
            membership.status = "active"
            membership.amount_paid = membership.expected_amount
            membership.start_date = start
            membership.renewal_date = renewal
            membership.end_date = renewal - timedelta(days=1)
            membership.save(update_fields=[
                "payment_status", "status", "amount_paid", "start_date",
                "renewal_date", "end_date", "updated_at",
            ])
            return True

        if membership.payment_status == target:
            return False
        # A failed attempt can be retried on the same intent. Never reset its
        # payment dates or amount while recording a failure/cancellation.
        membership.payment_status = target
        membership.save(update_fields=["payment_status", "updated_at"])
        return True


def create_pending_membership(*, option_id, first_name, last_name, email, phone=""):
    """Save an inactive member and link an unconfirmed, server-priced intent."""
    # Do not trust a caller's price, currency, reference, or payment state.
    amount = MEMBERSHIP_PRICES[option_id]
    reference = f"MEM-{uuid4().hex}"
    today = timezone.localdate()
    intent_id = None
    try:
        with transaction.atomic():
            # Historical records require dates; these are provisional and do not
            # confer membership time or activation until the verified webhook.
            membership = Membership.objects.create(
                first_name=first_name, last_name=last_name, email=email, phone=phone,
                membership_type=option_id, membership_option_id=option_id,
                amount_paid=0, expected_amount=amount, currency="usd",
                start_date=today, end_date=today, renewal_date=today,
                payment_status=Membership.PaymentStatus.PENDING,
                status="pending", reference_id=reference, checkout_reference=reference,
                notes="",
            )
            # Keep the row and intent link together for checkout; Stripe is not a
            # transaction participant, so the handler below cancels orphaned intents.
            session = create_membership_payment_intent(
                amount=amount, membership_option_id=option_id, internal_reference=reference,
            )
            intent_id = session["session_id"]
            # The unique database index prevents linking an intent to two rows.
            membership.stripe_payment_intent_id = intent_id
            membership.save(update_fields=["stripe_payment_intent_id", "updated_at"])
        return session
    except (DatabaseError, stripe.StripeError, RuntimeError, ValueError) as exc:
        # Stripe cannot join a database transaction. If persistence fails after
        # intent creation, do not return its secret; attempt to cancel it.
        # A uniqueness failure might mean this ID already belongs to another
        # valid membership; never cancel that membership's payment intent.
        if intent_id and not isinstance(exc, IntegrityError):
            try:
                cancel_membership_payment_intent(intent_id)
            except (stripe.StripeError, RuntimeError):
                pass  # The unreturned secret cannot be confirmed by this client.
        raise
