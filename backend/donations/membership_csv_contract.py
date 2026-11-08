"""The single ordered contract for membership-only CSV templates and later parsing."""

import csv
from io import StringIO

from donations.models import Membership
from donations.serializers import ManualMembershipCreateSerializer

# Keep the CSV in manual API field names. In particular, never offer encrypted
# storage names or server-controlled provenance and checkout fields to uploaders.
MEMBERSHIP_CSV_HEADERS = (
    "first_name", "last_name", "membership_type", "status", "email", "phone",
    "address", "membership_price", "amount_paid", "start_date", "end_date",
    "renewal_date", "payment_status", "payment_method", "reference_id", "notes",
)
REQUIRED_MEMBERSHIP_CSV_FIELDS = (
    "first_name", "last_name", "membership_type", "status",
)

# These limits are part of the published import contract; B2 will apply them
# before validation so that huge or unexpectedly long cells never reach DRF.
MAX_MEMBERSHIP_CSV_BYTES = 1_048_576
MAX_MEMBERSHIP_CSV_ROWS = 500
MEMBERSHIP_CSV_FIELD_LIMITS = {
    "first_name": 255, "last_name": 255, "membership_type": 255, "status": 255,
    "email": 254, "phone": 255, "address": 500, "membership_price": 12,
    "amount_paid": 12, "start_date": 10, "end_date": 10, "renewal_date": 10,
    "payment_status": 255, "payment_method": 20, "reference_id": 255, "notes": 500,
}

# Obtain choices from the same serializer/model that validate manual records,
# rather than maintaining an independent list of supported historical values.
MEMBERSHIP_CSV_STATUSES = ManualMembershipCreateSerializer.MEMBERSHIP_STATUSES
MEMBERSHIP_CSV_PAYMENT_STATUSES = ManualMembershipCreateSerializer.PAYMENT_STATUSES
MEMBERSHIP_CSV_PAYMENT_METHODS = tuple(Membership.PaymentMethod.values)


def membership_csv_manual_input(row: dict[str, str]) -> dict[str, str | None]:
    """Translate blank nullable CSV cells into the manual serializer's unknown value."""
    # DRF accepts an omitted optional date/choice, but rejects an empty string.
    # Keep the original strings for other fields, including "0.00" and blank
    # notes/references; the existing serializer validates and normalizes those.
    nullable = {
        "membership_price", "amount_paid", "start_date", "end_date", "renewal_date",
        "payment_status", "payment_method",
    }
    return {key: None if key in nullable and not value.strip() else value
            for key, value in row.items()}


def membership_csv_template() -> str:
    """Return a header-only template so example people cannot be imported accidentally."""
    output = StringIO(newline="")
    writer = csv.writer(output, lineterminator="\r\n")
    writer.writerow(MEMBERSHIP_CSV_HEADERS)
    return output.getvalue()
