from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import TypedDict

from django.conf import settings
from stripe import StripeClient


# Describes the expected return structure for type checkers and IDEs.
# TypedDict does not validate the dictionary at runtime.
class PaymentSession(TypedDict):
    session_id: str
    client_secret: str


def _convert_to_smallest_unit(amount: Decimal | str | int | float) -> int:
    """
    Convert a payment amount such as 10.50 into cents (smallest currency unit).
    Stripe API requires amounts to be integers representing the smallest unit
    of a currency (e.g., 1050 cents instead of 10.50 dollars).
    """
    try:
        # Cast to string first before passing to Decimal. 
        # This prevents precision loss that occurs when passing floats directly 
        # (e.g., Decimal(10.5) vs Decimal("10.5")).
        decimal_amount = Decimal(str(amount))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError("Payment amount must be a valid number.") from exc

    # This service only creates payments with a positive amount.
    if decimal_amount <= 0:
        raise ValueError("Payment amount must be greater than zero.")

    # Multiply by 100 to convert to cents.
    # The .quantize() method safely handles any fractions of a cent by rounding 
    # to the nearest whole number (e.g., 10.505 becomes 1051 cents).
    smallest_unit = (decimal_amount * 100).quantize(
        Decimal("1"),
        rounding=ROUND_HALF_UP,
    )

    # Stripe requires the final value to be a standard integer.
    return int(smallest_unit)


def create_payment_session(
    *,
    amount: Decimal | str | int | float,
    currency: str,
    payment_purpose: str,
    internal_reference: str,
    return_url: str,
) -> PaymentSession:
    """
    Create a reusable Stripe Checkout Session.
    
    This uses the 'elements' ui_mode, which is designed to embed the checkout 
    form directly into your own website using Stripe Elements, rather than 
    redirecting the user to a Stripe-hosted page.
    """
    
    # 1. Input Validation
    # Ensure all required strings are actually provided and not just empty spaces.
    if not currency.strip():
        raise ValueError("Currency is required.")

    if not payment_purpose.strip(): 
        raise ValueError("Payment purpose is required.")

    if not internal_reference.strip():
        raise ValueError("Internal reference is required.")

    if not return_url.strip():
        raise ValueError("Return URL is required.")

    # 2. Data Preparation
    amount_in_smallest_unit = _convert_to_smallest_unit(amount)
    
    # Stripe API expects currency codes to be lowercase (e.g., 'usd', 'eur').
    normalized_currency = currency.strip().lower()
    if normalized_currency != "usd":
        raise ValueError("Only USD payments are currently supported.")

    # Metadata is attached to Stripe objects so you can cross-reference 
    # incoming Stripe webhooks with your internal database records later.
    metadata = {
        "payment_purpose": payment_purpose,
        "internal_reference": internal_reference,
    }

    # Initialize the Stripe client using the secret key stored in Django settings.
    stripe_client = StripeClient(settings.STRIPE_SECRET_KEY)

    # 3. Session Creation
    session = stripe_client.v1.checkout.sessions.create(
        {
            # 'elements' mode generates a client_secret so you can embed the UI.
            "ui_mode": "elements",
            "mode": "payment",
            "return_url": return_url,
            # Associates the Stripe session with an internal payment or database record.
            "client_reference_id": internal_reference,
            
            # Define what the user is actually paying for.
            "line_items": [
                {
                    "price_data": {
                        "currency": normalized_currency,
                        "product_data": {
                            "name": payment_purpose,
                        },
                        "unit_amount": amount_in_smallest_unit,
                    },
                    "quantity": 1,
                }
            ],
            
            # Attach metadata to the Checkout Session itself.
            "metadata": metadata,
            
            # Also attach metadata to the underlying PaymentIntent. 
            # Copy the metadata to the PaymentIntent so it is also available
            # when processing PaymentIntent webhook events.
            "payment_intent_data": {
                "metadata": metadata,
            },
        }
    )

    # 4. Response Handling
    # The client_secret is strictly required to render the Stripe Elements UI on the frontend.
    if not session.client_secret:
        raise RuntimeError(
            "Stripe did not return a client secret for the payment session."
        )

    return {
        "session_id": session.id,
        "client_secret": session.client_secret,
    }