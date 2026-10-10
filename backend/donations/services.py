"""Membership checkout persistence; activation belongs to verified webhooks."""

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
