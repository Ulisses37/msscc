from decimal import Decimal

from django.db import transaction

from donations.models import Donation

MANUAL_DONATION_FIELDS = (
    "donor_first_name_encrypted", "donor_last_name_encrypted", "donor_email_encrypted",
    "donor_address_encrypted", "amount", "currency", "donation_date", "payment_method",
    "is_anonymous", "external_reference", "message",
)


def create_manual_donation(data: dict) -> Donation:
    """Validate and create received donations for authorized callers, including future imports.

    Callers enforce authorization. Inputs use external API names, not storage field names.
    """
    from donations.serializers import ManualDonationInputSerializer

    serializer = ManualDonationInputSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    return serializer.save()


@transaction.atomic
def _persist_manual_donation(validated_data: dict) -> Donation:
    """Save received facts and the generated reference together, without external actions."""
    fields = {key: value for key, value in validated_data.items() if key in MANUAL_DONATION_FIELDS}
    # Enforce privacy again even if trusted code supplies serializer.save(**kwargs).
    if fields["is_anonymous"]:
        for key in (
            "donor_first_name_encrypted", "donor_last_name_encrypted", "donor_address_encrypted",
        ):
            fields[key] = None
    donation = Donation.objects.create(
        **fields, record_source=Donation.RecordSource.MANUAL,
        payment_status=Donation.PaymentStatus.COMPLETED,
        contribute_to_processing_costs=False, processing_cost_contribution=Decimal("0.00"),
        total_amount=fields["amount"], reference_id="pending",
    )
    donation.reference_id = f"DON-MANUAL-{donation.pk:08d}"
    donation.save(update_fields=["reference_id"])
    return donation
