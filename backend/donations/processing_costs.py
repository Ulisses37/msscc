"""Estimated US domestic-card processing costs for donation and membership checkout.

Stripe's published standard rate is not a guarantee of the account's actual
rate (nonprofit, international, and alternative-payment rates can differ).
Update these two constants after verifying the account's contracted pricing.
"""

from decimal import ROUND_HALF_UP, Decimal

# Change these together after checking the account's Stripe pricing; quotes
# and newly saved payments share this function, but historical totals do not
# get recalculated when the assumed rate changes.
PROCESSING_PERCENT = Decimal("0.029")  # Standard US domestic-card rate: 2.9%.
PROCESSING_FIXED_CENTS = 30  # Standard US domestic-card charge: $0.30.
MAX_PAYMENT_CENTS = 9_999_999_999  # DecimalField(max_digits=10, decimal_places=2).


def calculate_donation_amounts(base: Decimal, contribute: bool) -> tuple[Decimal, Decimal]:
    """Return contribution and total, grossed up to cover the estimated fee.

    Work in whole cents, round the estimated charge half-up to a cent, and
    find the smallest total that leaves at least the requested base after
    that charge. Binary search avoids iterative recursion or cent drift.
    """
    if not base.is_finite() or base <= 0 or base.as_tuple().exponent < -2:
        raise ValueError("Invalid base donation amount.")
    base_cents = int(base * 100)
    if base_cents > MAX_PAYMENT_CENTS:
        raise ValueError("Donation exceeds the maximum payment amount.")
    if not contribute:
        return Decimal("0.00"), base

    def fee_cents(total_cents: int) -> int:
        return int(
            (Decimal(total_cents) * PROCESSING_PERCENT + PROCESSING_FIXED_CENTS)
            .quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        )

    # Gross up the entire charge, not just the original donation: the added
    # contribution itself also incurs a percentage fee. The monotone net
    # amount lets us find the minimum eligible whole-cent total by search.
    low, high = base_cents, MAX_PAYMENT_CENTS
    if high - fee_cents(high) < base_cents:
        raise ValueError("Donation plus processing costs exceeds the maximum payment amount.")
    while low < high:
        middle = (low + high) // 2
        if middle - fee_cents(middle) >= base_cents:
            high = middle
        else:
            low = middle + 1
    return Decimal(low - base_cents) / 100, Decimal(low) / 100
