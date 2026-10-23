from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import Donation, Membership


class StrictContributionChoiceField(serializers.BooleanField):
    """Require the form's actual JSON boolean, not DRF's string/number coercions."""

    def to_internal_value(self, data):
        if type(data) is not bool:
            raise serializers.ValidationError("Expected a boolean.")
        return data


class DonationSerializer(serializers.ModelSerializer):
    """Serializer for donation records."""

    donor_first_name = serializers.CharField(source="donor_first_name_encrypted", max_length=255)
    donor_last_name = serializers.CharField(source="donor_last_name_encrypted", max_length=255)
    donor_email = serializers.EmailField(source="donor_email_encrypted", max_length=254)
    contribute_to_processing_costs = StrictContributionChoiceField(required=False, default=False)

    class Meta:
        model = Donation
        fields = [
            "donation_id",
            "donor_first_name",
            "donor_last_name",
            "donor_email",
            "amount",
            "contribute_to_processing_costs",
            "processing_cost_contribution",
            "total_amount",
            "donation_date",
            "is_anonymous",
            "message",
            "payment_status",
            "reference_id",
            "created_at",
        ]
        read_only_fields = [
            "donation_id",
            "processing_cost_contribution",
            "total_amount",
            "donation_date",
            "payment_status",
            "reference_id",
            "created_at",
        ]
        extra_kwargs = {
            "is_anonymous": {"required": False, "default": False},
            "message": {"required": False, "allow_blank": True, "default": ""},
        }

    def validate_amount(self, value):
        """Require a donation amount greater than zero."""
        if value <= 0:
            raise serializers.ValidationError("Donation amount must be greater than zero.")
        return value

    def validate_donor_first_name(self, value):
        """Remove surrounding whitespace and reject an empty first name."""
        value = value.strip()
        if not value:
            raise serializers.ValidationError("First name is required.")
        return value

    def validate_donor_last_name(self, value):
        """Remove surrounding whitespace and reject an empty last name."""
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Last name is required.")
        return value

    def validate_donor_email(self, value):
        """Normalize email before storing it."""
        return value.strip().lower()

    def validate_message(self, value):
        """Keep optional donor messages short."""
        if len(value) > 500:
            raise serializers.ValidationError("Message cannot exceed 500 characters.")
        return value.strip()

    def create(self, validated_data):
        """Persist the opt-in, while monetary extras remain server-controlled."""
        with transaction.atomic():
            donation = Donation.objects.create(
                **validated_data,
                # SCRUM-744 will replace this zero with the agreed server fee.
                # Until then, the opt-in cannot change the amount charged.
                processing_cost_contribution=0,
                total_amount=validated_data["amount"],
                donation_date=timezone.localdate(),
                payment_status=Donation.PaymentStatus.PENDING,
                reference_id="pending",
            )
            donation.reference_id = f"DON-{donation.donation_id:08d}"
            donation.save(update_fields=["reference_id"])

        return donation

    def update(self, instance, validated_data):
        """Keep a zero-contribution total aligned with an edited base amount."""
        # Admin updates can change the existing writable base amount. Do not
        # leave a stale total behind while no contribution has been calculated.
        if "amount" in validated_data and instance.processing_cost_contribution == 0:
            validated_data["total_amount"] = validated_data["amount"]
        return super().update(instance, validated_data)


class MembershipSerializer(serializers.ModelSerializer):
    """Serializer for membership records."""

    first_name = serializers.CharField(source="first_name_encrypted", max_length=255)
    last_name = serializers.CharField(source="last_name_encrypted", max_length=255)
    email = serializers.EmailField(source="email_encrypted", max_length=254)
    phone = serializers.CharField(source="phone_encrypted", max_length=255)

    class Meta:
        model = Membership
        fields = [
            "membership_id",
            "first_name",
            "last_name",
            "email",
            "phone",
            "membership_type",
            "amount_paid",
            "start_date",
            "end_date",
            "renewal_date",
            "payment_status",
            "reference_id",
            "status",
            "notes",
            "created_at",
            "updated_at",
        ]
        # This serializer is for authorized manual records; public checkout
        # must use the separate membership payment-session endpoint.
        # Keep Stripe linkage and server pricing outside the manual-record API,
        # including its admin list response; only the checkout service writes them.
        read_only_fields = ["membership_id", "created_at", "updated_at"]
        # The model defaults pending for checkout-created rows; manual admin
        # submissions retain their existing explicit-status API contract.
        extra_kwargs = {
            "notes": {"max_length": 500},
            "payment_status": {"required": True},
        }
        # notes is a TextField without a model limit; bound API input even
        # though historical/admin-entered rows may contain longer notes.

    def validate_first_name(self, value):
        """Names are free text: keep apostrophes, hyphens and Unicode intact."""
        return value.strip()

    def validate_last_name(self, value):
        return value.strip()
