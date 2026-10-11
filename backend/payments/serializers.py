import re
from decimal import Decimal

from rest_framework import serializers


class StrictPaymentSerializer(serializers.Serializer):
    """Do not silently discard card details, prices, or other extra input."""

    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise serializers.ValidationError({"non_field_errors": ["Expected an object."]})
        # Reject the entire request before any field can be passed to Stripe.
        # Echoing an unknown key would be risky: callers may use a card value
        # itself as a key, not just as a value.
        unknown = set(data) - set(self.fields)
        if unknown:
            # Do not echo unknown keys or values: they may contain card data.
            raise serializers.ValidationError(
                {"non_field_errors": ["Unsupported payment information."]}
            )
        return super().to_internal_value(data)


class StrictChoiceField(serializers.ChoiceField):
    """DRF's ChoiceField coerces integers to strings; IDs must be strings."""

    # DRF's default invalid_choice message interpolates the rejected value.
    # Never echo untrusted payment input, which might itself contain card data.
    default_error_messages = {
        **serializers.ChoiceField.default_error_messages,
        "invalid_choice": "Unsupported value.",
    }

    def to_internal_value(self, data):
        if not isinstance(data, str):
            raise serializers.ValidationError("Expected a string.")
        return super().to_internal_value(data)


class StrictCharField(serializers.CharField):
    """Reject DRF's default number-to-text coercion for payment identifiers."""

    def run_validation(self, data=serializers.empty):
        if data is not serializers.empty and data is not None and not isinstance(data, str):
            raise serializers.ValidationError("Expected a string.")
        return super().run_validation(data)


class StrictAmountField(serializers.DecimalField):
    """Accept JSON numbers or decimal strings, never booleans or containers."""

    def run_validation(self, data=serializers.empty):
        if data is not serializers.empty and isinstance(data, (bool, list, dict)):
            raise serializers.ValidationError("Expected an amount.")
        return super().run_validation(data)


class PaymentSessionRequestSerializer(StrictPaymentSerializer):
    """
    Validate the information required to create a Stripe payment session.

    This serializer does not create a database record. It only validates
    data before it is passed to the reusable Stripe service.
    """

    # Accept amounts up to 99,999,999.99.
    # DecimalField avoids the precision problems associated with floats.
    # Booleans and nested JSON objects are not monetary amounts even though
    # Python treats bool as a subclass of int.
    amount = StrictAmountField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("0.01"),
    )

    # The Stripe service currently converts amounts using two decimal places,
    # so only USD is supported until other currency rules are implemented.
    currency = StrictChoiceField(
        choices=["usd"],
    )

    # Describes what the user is paying for. This value is also used in the
    # Stripe line item and payment metadata.
    # This generic-looking route currently supports only donations; allowing
    # arbitrary purpose strings would re-enable unpriced browser-led payments.
    payment_purpose = StrictChoiceField(choices=["Donation"])

    # Connects the Stripe session with an internal application record.
    # Stripe limits client_reference_id to 200 characters.
    internal_reference = StrictCharField(max_length=200, trim_whitespace=True)

    def validate_internal_reference(self, value):
        # Donation references are generated from the numeric database ID.
        # Reject other namespaces rather than letting them use client prices.
        if not re.fullmatch(r"DON-[0-9]{8,}", value):
            raise serializers.ValidationError("Invalid donation reference.")
        return value


# The frontend's membership prices are display-only. Until membership options
# have their own priced backend model, this is the authoritative USD catalog.
MEMBERSHIP_PRICES = {
    "student": Decimal("20.00"),
    "individual": Decimal("35.00"),
    "family": Decimal("50.00"),
    "corporate": Decimal("250.00"),
}


class MembershipPaymentSessionRequestSerializer(StrictPaymentSerializer):
    """Accept membership identity and selection, never browser-supplied pricing."""

    # The key is a catalog ID (not a database ID or a price); DRF's default
    # numeric-to-string coercion would hide a mistyped client payload.
    membership_option_id = StrictChoiceField(choices=tuple(MEMBERSHIP_PRICES))
    payment_purpose = StrictChoiceField(choices=["membership"])
    first_name = StrictCharField(max_length=255, trim_whitespace=True)
    last_name = StrictCharField(max_length=255, trim_whitespace=True)
    email = serializers.EmailField(max_length=254)
    phone = StrictCharField(max_length=50, required=False, allow_blank=True, trim_whitespace=True)

    def validate_email(self, value):
        return value.strip().lower()
