"""Read-only validation of the fixed donation CSV, without checkout or writes."""

import csv
import re
from io import StringIO

from donations.donation_csv_contract import (
    DONATION_CSV_ANONYMITY_VALUES,
    DONATION_CSV_FIELD_LIMITS,
    DONATION_CSV_HEADERS,
    MAX_DONATION_CSV_BYTES,
    MAX_DONATION_CSV_ROWS,
    donation_csv_manual_input,
)
from donations.serializers import ManualDonationInputSerializer

# Manual entry accepts JSON values; CSV deliberately has a narrower spelling.
# In particular, signs, exponent notation and separators are not historical
# amount facts we should reinterpret silently. Calendar validity and range
# remain the responsibility of the existing manual-entry serializer.
DECIMAL_CSV_PATTERN = re.compile(r"^(?:0|[1-9][0-9]{0,7})(?:\.[0-9]{1,2})?$")
DATE_CSV_PATTERN = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
CONTACT_STORAGE_FIELDS = {
    "donor_first_name": "donor_first_name_encrypted",
    "donor_last_name": "donor_last_name_encrypted",
    "donor_email": "donor_email_encrypted",
    "address": "donor_address_encrypted",
}
ANONYMOUS_IDENTITY_FIELDS = ("donor_first_name", "donor_last_name", "address")


def _error(row: int, field: str, message: str) -> dict:
    """Return a fixed diagnostic, never a CSV value or DRF exception string."""
    return {"row": row, "field": field, "message": message}


def _safe_proposal(validated: dict) -> dict:
    """Display only normalized CSV facts, not encrypted storage or checkout keys."""
    values = {}
    for field in DONATION_CSV_HEADERS:
        value = validated.get(CONTACT_STORAGE_FIELDS.get(field, field))
        # Decimal/date instances are not JSON-native. Stable strings make the
        # original known facts reviewable without altering the saved meaning.
        if field == "amount":
            value = str(value)
        elif field == "donation_date":
            value = value.isoformat()
        values[field] = value
    return values


def _validate_row(row: dict[str, str], row_number: int) -> tuple[list[dict], dict | None]:
    """Check CSV-specific rules before reusing manual-entry validation."""
    errors = []
    invalid = set()
    for field, value in row.items():
        if len(value) > DONATION_CSV_FIELD_LIMITS[field]:
            errors.append(_error(row_number, field, "Cell exceeds its character limit."))
            invalid.add(field)
        elif field == "amount" and value and not DECIMAL_CSV_PATTERN.fullmatch(value):
            errors.append(_error(row_number, field, "Use a positive decimal without separators."))
            invalid.add(field)
        elif field == "donation_date" and value and not DATE_CSV_PATTERN.fullmatch(value):
            errors.append(_error(row_number, field, "Use YYYY-MM-DD for a received donation."))
            invalid.add(field)
        elif field == "is_anonymous" and value not in DONATION_CSV_ANONYMITY_VALUES:
            errors.append(_error(row_number, field, "Use true or false, not an unknown value."))
            invalid.add(field)

    if row["is_anonymous"] == "true":
        # Manual entry intentionally discards names/address for anonymous
        # records. An import must instead request correction so admins see the
        # mistake before confirmation, even if a supplied cell is overlong.
        for field in ANONYMOUS_IDENTITY_FIELDS:
            if row[field].strip() and field not in invalid:
                errors.append(_error(row_number, field, "Leave blank for an anonymous donation."))
                invalid.add(field)

    # Keep collecting independent errors from DRF. Invalid optional cells are
    # omitted only for diagnostics, never to build a saveable proposal. Use
    # harmless substitutes for malformed required cells to avoid duplicate
    # errors and allow other valid cells to be checked in the same pass.
    diagnostic = {field: value for field, value in row.items() if field not in invalid}
    for field, placeholder in (("amount", "1.00"), ("donation_date", "2000-01-01"),
                               ("is_anonymous", "false")):
        if field in invalid:
            diagnostic[field] = placeholder
    serializer = ManualDonationInputSerializer(data=donation_csv_manual_input(diagnostic))
    if not serializer.is_valid():
        for field in serializer.errors:
            # Arbitrary serializer messages may include private input; emit
            # only a known CSV field or a row-level marker with fixed text.
            safe_field = field if field in DONATION_CSV_HEADERS else "row"
            if safe_field not in invalid:
                errors.append(_error(row_number, safe_field, "Invalid or missing value."))
    return errors, _safe_proposal(serializer.validated_data) if not errors else None


def parse_donation_csv(raw: bytes) -> dict:
    """Validate a bounded donation upload and return proposed facts without saving."""
    result = {"record_type": "donation", "row_count": 0, "proposed_records": [], "errors": []}
    if not raw or len(raw) > MAX_DONATION_CSV_BYTES:
        result["errors"].append(_error(
            1, "file", "CSV must be nonempty and at most 1,048,576 bytes.",
        ))
        return result
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        result["errors"].append(_error(1, "file", "CSV must use UTF-8 encoding."))
        return result
    if "\x00" in text:
        result["errors"].append(_error(1, "file", "CSV contains an unsupported character."))
        return result

    # Preserve physical line positions through CRLF, LF and quoted multiline
    # cells; strict mode rejects unclosed quotes instead of guessing columns.
    reader = csv.reader(StringIO(text, newline=""), strict=True)
    try:
        headers = next(reader, None)
        if headers is None or tuple(headers) != DONATION_CSV_HEADERS:
            result["errors"].append(_error(
                1, "header", "Use the exact donation template headers in order.",
            ))
            return result
        previous_line = reader.line_num
        for cells in reader:
            row_number = previous_line + 1
            previous_line = reader.line_num
            result["row_count"] += 1
            if result["row_count"] > MAX_DONATION_CSV_ROWS:
                result["errors"].append(_error(
                    row_number, "file", "CSV may contain at most 500 data rows.",
                ))
                return result
            if len(cells) != len(DONATION_CSV_HEADERS):
                result["errors"].append(_error(
                    row_number, "row", "Row must have exactly 10 columns and cannot be blank.",
                ))
                continue
            row = dict(zip(DONATION_CSV_HEADERS, cells, strict=True))
            errors, values = _validate_row(row, row_number)
            result["errors"].extend(errors)
            if values is not None:
                result["proposed_records"].append({"row": row_number, "values": values})
    except csv.Error:
        # A malformed file makes row boundaries unreliable. Discard earlier
        # proposals instead of exposing a partially reviewable batch.
        result["errors"].append(_error(
            reader.line_num or 1, "file", "CSV is malformed; check quoting and line endings.",
        ))
        result["proposed_records"] = []
        return result
    if result["row_count"] == 0:
        result["errors"].append(_error(2, "file", "CSV must contain at least one data row."))
    return result
