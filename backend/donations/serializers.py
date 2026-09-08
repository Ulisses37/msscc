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
        read_only_fields = ["donation_id", "created_at"]


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
