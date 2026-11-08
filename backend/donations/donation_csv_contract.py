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
# Amount and date cannot be inferred. Blank anonymity means an ordinary,
# non-anonymous record even when historical contact details are unavailable.
REQUIRED_DONATION_CSV_FIELDS = ("amount", "donation_date")
# CSV carries text rather than JSON booleans. Normalize case and surrounding
# whitespace; only an empty cell defaults to false, never an unknown word.
DONATION_CSV_ANONYMITY_VALUES = ("true", "false")
# CSV also accepts the familiar credit_card spelling; persist its canonical
# card value so manual entry, duplicate matching and retries agree.
DONATION_CSV_PAYMENT_METHODS = tuple(ManualDonationInputSerializer.PAYMENT_METHODS)
DONATION_CSV_PAYMENT_ALIASES = {"credit_card": Donation.PaymentMethod.CARD}
# Neither value is an upload column: the server records already-received USD
# donations as completed instead of trusting a CSV to choose payment state.
DONATION_CSV_RECEIVED_STATUS = Donation.PaymentStatus.COMPLETED
DONATION_CSV_CURRENCY = "usd"

# Bound uploaded bytes and rows before validating the retained CSV facts.
MAX_DONATION_CSV_BYTES = 1_048_576
MAX_DONATION_CSV_ROWS = 500
# Match the storage/manual-input limits, while keeping money at the largest
# positive value supported by DecimalField(max_digits=10, decimal_places=2).
# These are published limits; the later upload parser must enforce every one.
DONATION_CSV_FIELD_LIMITS = {
    # Allow modest spreadsheet padding in the raw boolean cell; the only
    # accepted semantic values still normalize to five characters or fewer.
    "amount": 11, "donation_date": 10, "is_anonymous": 32, "payment_method": 20,
    "donor_first_name": 255, "donor_last_name": 255, "donor_email": 254,
    "address": 500, "external_reference": 255, "message": 500,
}


def donation_csv_manual_input(row: dict[str, str]) -> dict[str, str | bool | None]:
    """Map optional unknowns and explicit anonymity to the manual input contract.

    Reject unknown nonblank anonymity instead of silently interpreting it as false.
    The upload parser checks required cells and format before calling this helper.
    """
    anonymity = row.get("is_anonymous", "").strip().casefold()
    if anonymity and anonymity not in DONATION_CSV_ANONYMITY_VALUES:
        raise ValueError("Unsupported donation anonymity value.")
    # DRF treats an omitted optional choice differently from an empty string.
    # Convert only nullable optional facts; leave required amount/date untouched
    # so missing values cannot be mistaken for zero or today's date.
    nullable = {"payment_method", "donor_first_name", "donor_last_name", "donor_email", "address"}
    result = {
        key: (anonymity == "true" if key == "is_anonymous" else
              None if key in nullable and not value.strip() else value)
        for key, value in row.items()
    }
    if anonymity == "true":
        # Strip identifying cells before manual validation and review, not just
        # at persistence: otherwise malformed names or addresses can leak in
        # preview diagnostics or make an intentionally anonymous row unsaveable.
        for key in ("donor_first_name", "donor_last_name", "address"):
            result[key] = None
    return result


def donation_csv_template() -> str:
    """Generate a header-only CSV so no fictional contact can be imported by accident."""
    output = StringIO(newline="")
    # A CSV writer, rather than manual string joining, keeps the download tied
    # to the exact ordered parser headers and produces spreadsheet-friendly CRLF.
    writer = csv.writer(output, lineterminator="\r\n")
    writer.writerow(DONATION_CSV_HEADERS)
    return output.getvalue()
