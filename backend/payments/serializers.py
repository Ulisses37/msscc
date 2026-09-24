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