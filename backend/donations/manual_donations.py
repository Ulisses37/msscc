from decimal import Decimal

from django.db import transaction

from donations.models import Donation

MANUAL_DONATION_FIELDS = (
    "donor_first_name_encrypted", "donor_last_name_encrypted", "donor_email_encrypted",
    "donor_address_encrypted", "amount", "currency", "donation_date", "payment_method",
    "is_anonymous", "external_reference", "message",
)


def create_manual_donation(data: dict, *, import_batch=None) -> Donation:
    """Validate and create received donations for authorized callers, including future imports.

    Callers enforce authorization. Inputs use external API names, not storage field names.
    """
    from donations.serializers import ManualDonationInputSerializer

    serializer = ManualDonationInputSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    # The browser never supplies provenance or batch: only an authorized
    # confirmation passes this server-owned argument after revalidation.
    return serializer.save(import_batch=import_batch) if import_batch else serializer.save()


@transaction.atomic
def _persist_manual_donation(validated_data: dict) -> Donation:
    """Save received facts and the generated reference together, without external actions."""
    fields = {key: value for key, value in validated_data.items() if key in MANUAL_DONATION_FIELDS}
    import_batch = validated_data.get("import_batch")
    # Enforce privacy again even if trusted code supplies serializer.save(**kwargs).
    if fields["is_anonymous"]:
        for key in (
            "donor_first_name_encrypted", "donor_last_name_encrypted", "donor_address_encrypted",
        ):
            fields[key] = None
    donation = Donation.objects.create(
        **fields,
        record_source=(Donation.RecordSource.CSV_IMPORT if import_batch
                       else Donation.RecordSource.MANUAL),
        import_batch=import_batch,
        payment_status=Donation.PaymentStatus.COMPLETED,
        contribute_to_processing_costs=False, processing_cost_contribution=Decimal("0.00"),
        total_amount=fields["amount"], reference_id="pending",
    )
    prefix = "DON-CSV" if import_batch else "DON-MANUAL"
    donation.reference_id = f"{prefix}-{donation.pk:08d}"
    donation.save(update_fields=["reference_id"])
    return donation
