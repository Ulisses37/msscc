"""Read-only validation of the fixed donation CSV, without checkout or writes."""

import csv
import re
from datetime import datetime
from io import StringIO

from donations.donation_csv_contract import (
    DONATION_CSV_ANONYMITY_VALUES,
    DONATION_CSV_FIELD_LIMITS,
    DONATION_CSV_HEADERS,
    DONATION_CSV_PAYMENT_METHODS,
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
# Excel can export the same US date with either separator. Require a single
# consistent separator so an ambiguous/mixed spelling is never guessed.
US_DATE_CSV_PATTERN = re.compile(r"^[0-9]{2}(?P<separator>[-/])[0-9]{2}(?P=separator)[0-9]{4}$")
# Date-looking amounts sometimes come from spreadsheet auto-formatting. The
# numeric original cannot be reconstructed reliably from the exported CSV.
SPREADSHEET_AMOUNT_DATE = re.compile(
    r"^(?:[0-9]{4}[-/][0-9]{2}[-/][0-9]{2}|[0-9]{2}[-/][0-9]{2}[-/][0-9]{4})$",
)
# Echo only these fixed, non-identifying choice tokens. A name or address
# pasted into a choice column must never be reflected in an error response.
DISPLAYABLE_CHOICE_TOKENS = frozenset({"paid", "unpaid", "card", "yes", "no", "unknown"})
AMOUNT_GUIDANCE = (
    "Amount must be positive USD, at most 99,999,999.99 with up to two decimal places."
)
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


def _choice_error(raw: str, allowed: tuple[str, ...], *, optional: bool) -> str:
    """Explain choices while showing only predetermined non-private mistakes."""
    choice = raw.strip().casefold()
    prefix = f'"{choice}" is not recognized. ' if choice in DISPLAYABLE_CHOICE_TOKENS else ""
    suffix = " Leave blank if unknown." if optional else ""
    return f"{prefix}Use one of: {', '.join(allowed)}.{suffix}"


def _serializer_error(field: str, codes: list[str]) -> str:
    """Translate DRF validation codes to fixed guidance instead of reflecting input."""
    if field == "amount":
        if "required" in codes or "blank" in codes:
            return "A known positive USD amount is required; do not leave blank."
        return AMOUNT_GUIDANCE
    if field == "donation_date":
        if "required" in codes or "blank" in codes:
            return "A known donation date is required."
        return "Enter a real, non-future donation date in YYYY-MM-DD, MM-DD-YYYY or MM/DD/YYYY."
    if field == "donor_email":
        return "Enter a valid email address or leave blank if unknown."
    if field == "row":
        return "Check this row's donation facts and required fields."
    return "Check this field's format or leave it blank if unknown."


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
    # Normalize the explicit boolean and the supported Excel date spellings
    # before manual validation. Never guess a blank date or boolean.
    raw_anonymity_length = len(row["is_anonymous"])
    raw_method_length = len(row["payment_method"])
    # Match the spreadsheet-friendly boolean rule for the other CSV choice.
    # Normalized proposals/fingerprints must not differ for Cash vs cash.
    row = {**row, "is_anonymous": row["is_anonymous"].strip().casefold(),
           "payment_method": row["payment_method"].strip().casefold()}
    us_date = row["donation_date"]
    us_date_match = US_DATE_CSV_PATTERN.fullmatch(us_date)
    if us_date_match:
        try:
            # Date-only, fixed-width US values are unambiguous. Convert to the
            # existing ISO manual-input contract rather than changing the
            # serializer used by other donation entry points.
            date_format = "%m-%d-%Y" if us_date_match.group("separator") == "-" else "%m/%d/%Y"
            row["donation_date"] = datetime.strptime(us_date, date_format).date().isoformat()
        except ValueError:
            # Let the existing manual serializer report impossible calendar
            # dates as a safe row/field error, never echo the uploaded value.
            pass
    for field, value in row.items():
        # Enforce the published bound on the original cell before trimming;
        # otherwise arbitrarily large whitespace would bypass the cell limit.
        length = (raw_anonymity_length if field == "is_anonymous" else
                  raw_method_length if field == "payment_method" else len(value))
        if length > DONATION_CSV_FIELD_LIMITS[field]:
            # Keep diagnostics independent of private uploaded cell contents.
            guidance = (AMOUNT_GUIDANCE if field == "amount" else
                        f"Use at most {DONATION_CSV_FIELD_LIMITS[field]} characters.")
            errors.append(_error(row_number, field, guidance))
            invalid.add(field)
        elif field == "amount" and value and not DECIMAL_CSV_PATTERN.fullmatch(value):
            guidance = ("This amount looks like a spreadsheet date. Restore the original numeric "
                        "amount in the CSV; the original cannot be inferred."
                        if SPREADSHEET_AMOUNT_DATE.fullmatch(value) else
                        "Use a positive USD amount with up to two decimal places, without symbols, "
                        "separators or signs.")
            errors.append(_error(row_number, field, guidance))
            invalid.add(field)
        elif field == "amount" and not value:
            # Empty CSV cells become an invalid Decimal, not DRF's `required`
            # code; report the missing historical fact explicitly instead.
            errors.append(_error(
                row_number, field, "A known positive USD amount is required; do not leave blank.",
            ))
            invalid.add(field)
        elif field == "donation_date" and value and not (
            DATE_CSV_PATTERN.fullmatch(value) or US_DATE_CSV_PATTERN.fullmatch(value)
        ):
            errors.append(_error(
                row_number, field,
                "Use YYYY-MM-DD, MM-DD-YYYY, or MM/DD/YYYY for a received donation.",
            ))
            invalid.add(field)
        elif field == "is_anonymous" and value not in DONATION_CSV_ANONYMITY_VALUES:
            errors.append(_error(row_number, field, _choice_error(
                value, DONATION_CSV_ANONYMITY_VALUES, optional=False,
            ) if value else "An explicit true or false is required; do not leave blank."))
            invalid.add(field)
        elif field == "payment_method" and value and value not in DONATION_CSV_PAYMENT_METHODS:
            errors.append(_error(row_number, field, _choice_error(
                value, DONATION_CSV_PAYMENT_METHODS, optional=True,
            )))
            invalid.add(field)
        elif field == "donation_date" and not value:
            # Never fill a historical donation's unknown date with today.
            errors.append(_error(
                row_number, field,
                "A known donation date is required (YYYY-MM-DD, MM-DD-YYYY or MM/DD/YYYY).",
            ))
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
                codes = [detail.code for detail in serializer.errors[field]]
                errors.append(_error(row_number, safe_field, _serializer_error(safe_field, codes)))
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
