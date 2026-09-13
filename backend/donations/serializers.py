from django.utils import timezone
from rest_framework import serializers

from .models import Donation, Membership


class DonationSerializer(serializers.ModelSerializer):
    """Serializer for donation records."""

    class Meta:
        model = Donation
        fields = [
            "donation_id",
            "donor_first_name",
            "donor_last_name",
            "donor_email",
            "amount",
            "donation_date",
            "is_anonymous",
            "message",
            "payment_status",
            "reference_id",
            "created_at",
        ]
        read_only_fields = [
            "donation_id",
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
        """Set server-controlled fields without requiring a database migration."""
        donation = Donation.objects.create(
            **validated_data,
            donation_date=timezone.localdate(),
            payment_status="incomplete",
            reference_id="pending",
        )
        donation.reference_id = f"DON-{donation.donation_id:08d}"
        donation.save(update_fields=["reference_id"])
        return donation


class MembershipSerializer(serializers.ModelSerializer):
    """Serializer for membership records."""

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
        read_only_fields = ["membership_id", "created_at", "updated_at"]
