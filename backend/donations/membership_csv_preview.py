import csv
import re
from io import StringIO

from rest_framework.exceptions import ValidationError

from donations.membership_csv_contract import (
    MAX_MEMBERSHIP_CSV_BYTES,
    MAX_MEMBERSHIP_CSV_ROWS,
    MEMBERSHIP_CSV_FIELD_LIMITS,
    MEMBERSHIP_CSV_HEADERS,
    membership_csv_manual_input,
)
from donations.serializers import ManualMembershipCreateSerializer

DATE_FIELDS = frozenset({"start_date", "end_date", "renewal_date"})
MONEY_FIELDS = frozenset({"membership_price", "amount_paid"})
# Reject currency symbols, separators, signs and exponent notation even when
# the manual JSON serializer might accept an alternate representation.
DECIMAL_CSV_PATTERN = re.compile(r"^(?:0|[1-9][0-9]{0,7})(?:\.[0-9]{1,2})?$")
DATE_CSV_PATTERN = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")


def _error(row: int, field: str, message: str) -> dict:
    """Use fixed feedback, never echo uploaded values or DRF exception text."""
    return {"row": row, "field": field, "message": message}


def _safe_proposal(validated: dict) -> dict:
    """Project validated manual facts back to CSV names without storage or checkout keys."""
    proposal = {}
    for field in MEMBERSHIP_CSV_HEADERS:
        stored = f"{field}_encrypted" if field in ("first_name", "last_name", "email",
                                                    "phone", "address") else field
        value = validated.get(stored)
        # Decimal and date are not JSON-native; retain fixed decimal strings
        # and ISO dates so zero, null, and actual historical facts stay distinct.
        if field in MONEY_FIELDS and value is not None:
            value = str(value)
        elif field in DATE_FIELDS and value is not None:
            value = value.isoformat()
        proposal[field] = value
    return proposal


def parse_membership_csv(raw: bytes) -> dict:
    """Validate a bounded, fixed-template batch without saving any records."""
    result = {"record_type": "membership", "row_count": 0, "proposed_records": [], "errors": []}
    if not raw or len(raw) > MAX_MEMBERSHIP_CSV_BYTES:
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

    # newline="" leaves quoted newlines and CRLF handling to the CSV reader.
    reader = csv.reader(StringIO(text, newline=""), strict=True)
    try:
        headers = next(reader, None)
        if headers is None or tuple(headers) != MEMBERSHIP_CSV_HEADERS:
            result["errors"].append(_error(
                1, "header", "Use the exact membership template headers in order.",
            ))
            return result
        previous_line = reader.line_num
        for cells in reader:
            row_number = previous_line + 1
            previous_line = reader.line_num
            result["row_count"] += 1
            if result["row_count"] > MAX_MEMBERSHIP_CSV_ROWS:
                result["errors"].append(_error(
                    row_number, "file", "CSV may contain at most 500 data rows.",
                ))
                return result
            if len(cells) != len(MEMBERSHIP_CSV_HEADERS):
                result["errors"].append(_error(
                    row_number, "row", "Row must have exactly 16 columns and cannot be blank.",
                ))
                continue
            row = dict(zip(MEMBERSHIP_CSV_HEADERS, cells, strict=True))
            invalid_fields = set()
            for field, value in row.items():
                if len(value) > MEMBERSHIP_CSV_FIELD_LIMITS[field]:
                    result["errors"].append(_error(
                        row_number, field, "Cell exceeds its character limit.",
                    ))
                    invalid_fields.add(field)
                elif (field in DATE_FIELDS and value.strip()
                      and not DATE_CSV_PATTERN.fullmatch(value)):
                    result["errors"].append(_error(
                        row_number, field, "Use YYYY-MM-DD or leave blank.",
                    ))
                    invalid_fields.add(field)
                elif (field in MONEY_FIELDS and value.strip()
                      and not DECIMAL_CSV_PATTERN.fullmatch(value)):
                    result["errors"].append(_error(
                        row_number, field, "Use a nonnegative decimal without separators.",
                    ))
                    invalid_fields.add(field)
            # Validate other cells even if a CSV-format check already failed.
            # Omit invalid optional fields (manual rules treat them as unknown)
            # and supply a harmless valid required value only for diagnostics.
            diagnostic_row = {
                key: ("valid" if key in invalid_fields and key in
                      ("first_name", "last_name", "membership_type") else value)
                for key, value in row.items() if key not in invalid_fields or key in
                ("first_name", "last_name", "membership_type")
            }
            serializer = ManualMembershipCreateSerializer(
                data=membership_csv_manual_input(diagnostic_row),
            )
            if not serializer.is_valid():
                for field in serializer.errors:
                    # Report the location, not submitted contact data or arbitrary error strings.
                    safe_field = field if field in MEMBERSHIP_CSV_HEADERS else "row"
                    if safe_field not in invalid_fields:
                        result["errors"].append(_error(
                            row_number, safe_field, "Invalid or missing value.",
                        ))
                continue
            if invalid_fields:
                continue
            result["proposed_records"].append({
                "row": row_number, "values": _safe_proposal(serializer.validated_data),
            })
    except (csv.Error, ValueError, ValidationError):
        result["errors"].append(_error(
            reader.line_num or 1, "file", "CSV is malformed; check quoting and line endings.",
        ))
        result["proposed_records"] = []
        return result
    if result["row_count"] == 0:
        result["errors"].append(_error(2, "file", "CSV must contain at least one data row."))
    return result
