from django.db import transaction

from donations.models import Membership

MANUAL_MEMBERSHIP_FIELDS = (
    "first_name_encrypted", "last_name_encrypted", "email_encrypted", "phone_encrypted",
    "address_encrypted", "membership_type", "membership_price", "amount_paid", "start_date",
    "end_date", "renewal_date", "payment_status", "payment_method", "reference_id", "status",
    "notes",
)


def create_manual_membership(data: dict) -> Membership:
    """Validate and create manual input for authorized callers, including future imports.

    Callers enforce their own authorization. Input uses the same external field names
    as the manual API, never checkout or encrypted-storage field names.
    """
    # Import lazily because this serializer delegates persistence back to this module.
    from donations.serializers import ManualMembershipCreateSerializer

    serializer = ManualMembershipCreateSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    return serializer.save()


@transaction.atomic
def _persist_manual_membership(validated_data: dict) -> Membership:
    """Persist validated manual facts and their reference as one database operation."""
    # An allowlist also protects against checkout values supplied through save(**kwargs).
    fields = {
        key: value for key, value in validated_data.items() if key in MANUAL_MEMBERSHIP_FIELDS
    }
    membership = Membership.objects.create(
        **fields, record_source=Membership.RecordSource.MANUAL,
    )
    if not membership.reference_id:
        membership.reference_id = f"MEM-MANUAL-{membership.pk:08d}"
        membership.save(update_fields=["reference_id"])
    return membership
