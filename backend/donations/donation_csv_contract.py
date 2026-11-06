"""The fixed donation CSV contract, separate from exports and checkout inputs."""

import csv
from io import StringIO

from donations.models import Donation
from donations.serializers import ManualDonationInputSerializer

# Use external manual-entry names, never encrypted storage keys, checkout IDs,
# provenance, fees, or a client-selected payment status. Every row represents
# one already-received donation; confirmation will assign completed status.
DONATION_CSV_HEADERS = (
    "amount", "donation_date", "is_anonymous", "payment_method",
    "donor_first_name", "donor_last_name", "donor_email", "address",
    "external_reference", "message",
)
# Amount and date are facts a received donation cannot infer. Anonymity is
# explicit so missing contact information does not silently imply anonymity.
REQUIRED_DONATION_CSV_FIELDS = ("amount", "donation_date", "is_anonymous")
# CSV carries text rather than JSON booleans; spellings are intentionally narrow
# so "unknown", "yes", and blank cannot turn into a non-anonymous donation.
DONATION_CSV_ANONYMITY_VALUES = ("true", "false")
# Keep available methods in sync with manual entry, not checkout's card methods.
DONATION_CSV_PAYMENT_METHODS = tuple(ManualDonationInputSerializer.PAYMENT_METHODS)
# Neither value is an upload column: the server records already-received USD
# donations as completed instead of trusting a CSV to choose payment state.
DONATION_CSV_RECEIVED_STATUS = Donation.PaymentStatus.COMPLETED
DONATION_CSV_CURRENCY = "usd"

# Keep the membership import's file/row bounds; C2 will enforce these and the
# per-cell bounds during parsing, before passing values to manual validation.
MAX_DONATION_CSV_BYTES = 1_048_576
MAX_DONATION_CSV_ROWS = 500
# Match the storage/manual-input limits, while keeping money at the largest
# positive value supported by DecimalField(max_digits=10, decimal_places=2).
# These are published limits; the later upload parser must enforce every one.
DONATION_CSV_FIELD_LIMITS = {
    "amount": 11, "donation_date": 10, "is_anonymous": 5, "payment_method": 20,
    "donor_first_name": 255, "donor_last_name": 255, "donor_email": 254,
    "address": 500, "external_reference": 255, "message": 500,
}


def donation_csv_manual_input(row: dict[str, str]) -> dict[str, str | bool | None]:
    """Map optional unknowns and explicit anonymity to the manual input contract.

    Reject unknown anonymity instead of silently interpreting it as false.
    C2 also checks required cells and format before calling this helper.
    """
    if row.get("is_anonymous") not in DONATION_CSV_ANONYMITY_VALUES:
        raise ValueError("Unsupported donation anonymity value.")
    # DRF treats an omitted optional choice differently from an empty string.
    # Convert only nullable optional facts; leave required amount/date untouched
    # so missing values cannot be mistaken for zero or today's date.
    nullable = {"payment_method", "donor_first_name", "donor_last_name", "donor_email", "address"}
    return {
        key: (value == "true" if key == "is_anonymous" else
              None if key in nullable and not value.strip() else value)
        for key, value in row.items()
    }


def donation_csv_template() -> str:
    """Generate a header-only CSV so no fictional contact can be imported by accident."""
    output = StringIO(newline="")
    # A CSV writer, rather than manual string joining, keeps the download tied
    # to the exact ordered parser headers and produces spreadsheet-friendly CRLF.
    writer = csv.writer(output, lineterminator="\r\n")
    writer.writerow(DONATION_CSV_HEADERS)
    return output.getvalue()
