from decimal import Decimal

from rest_framework import serializers


class PaymentSessionRequestSerializer(serializers.Serializer):
    """
    Validate the information required to create a Stripe payment session.

    This serializer does not create a database record. It only validates
    data before it is passed to the reusable Stripe service.
    """

    # Accept amounts up to 99,999,999.99.
    # DecimalField avoids the precision problems associated with floats.
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("0.01"),
    )

    # The Stripe service currently converts amounts using two decimal places,
    # so only USD is supported until other currency rules are implemented.
    currency = serializers.ChoiceField(
        choices=["usd"],
        default="usd",
    )

    # Describes what the user is paying for. This value is also used in the
    # Stripe line item and payment metadata.
    payment_purpose = serializers.CharField(
        max_length=100,
        trim_whitespace=True,
    )

    # Connects the Stripe session with an internal application record.
    # Stripe limits client_reference_id to 200 characters.
    internal_reference = serializers.CharField(
        max_length=200,
        trim_whitespace=True,
    )


# The frontend's membership prices are display-only. Until membership options
# have their own priced backend model, this is the authoritative USD catalog.
MEMBERSHIP_PRICES = {
    "student": Decimal("20.00"),
    "individual": Decimal("35.00"),
    "family": Decimal("50.00"),
    "corporate": Decimal("250.00"),
}


class MembershipPaymentSessionRequestSerializer(serializers.Serializer):
    """Accept only a membership selection, never browser-supplied pricing."""

    membership_option_id = serializers.ChoiceField(choices=tuple(MEMBERSHIP_PRICES))
    payment_purpose = serializers.ChoiceField(choices=["membership"])

    def validate(self, attrs):
        # DRF otherwise silently discards unknown fields. Explicit rejection
        # prevents clients from mistakenly treating a supplied price as trusted
        # and ensures card data cannot enter this endpoint's request contract.
        if not isinstance(self.initial_data, dict) or set(self.initial_data) - set(self.fields):
            raise serializers.ValidationError("Unsupported payment information.")
        return attrs
