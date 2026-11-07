import csv
import re
from datetime import date
from io import StringIO

from rest_framework.exceptions import ValidationError

from donations.membership_csv_contract import (
    MAX_MEMBERSHIP_CSV_BYTES,
    MAX_MEMBERSHIP_CSV_ROWS,
    MEMBERSHIP_CSV_FIELD_LIMITS,
    MEMBERSHIP_CSV_HEADERS,
    MEMBERSHIP_CSV_PAYMENT_METHODS,
    MEMBERSHIP_CSV_PAYMENT_STATUSES,
    MEMBERSHIP_CSV_STATUSES,
    membership_csv_manual_input,
)
from donations.serializers import ManualMembershipCreateSerializer

DATE_FIELDS = frozenset({"start_date", "end_date", "renewal_date"})
MONEY_FIELDS = frozenset({"membership_price", "amount_paid"})
CHOICE_FIELDS = {
    "status": MEMBERSHIP_CSV_STATUSES,
    "payment_status": MEMBERSHIP_CSV_PAYMENT_STATUSES,
    "payment_method": MEMBERSHIP_CSV_PAYMENT_METHODS,
}
# Choice errors can show short, simple tokens for correction. Never echo
# arbitrary CSV content: it could be contact data pasted into the wrong cell.
DISPLAYABLE_CHOICE = re.compile(r"^[A-Za-z_]{1,20}$")
# Reject currency symbols, separators, signs and exponent notation even when
# the manual JSON serializer might accept an alternate representation.
DECIMAL_CSV_PATTERN = re.compile(r"^(?:0|[1-9][0-9]{0,7})(?:\.[0-9]{1,2})?$")
# A spreadsheet may turn a payment into date-shaped text before exporting.
# Never reverse-engineer the amount from that date: its original value is lost.
SPREADSHEET_DATE_SHAPE = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
# Excel often exports US dates; accept both orders with either consistent
# separator, but canonicalize to ISO before the manual serializer validates
# real calendar dates. Never guess the meaning of ambiguous mixed formats.
ISO_DATE_CSV_PATTERN = re.compile(r"^([0-9]{4})([-/])([0-9]{2})\2([0-9]{2})$")
US_DATE_CSV_PATTERN = re.compile(r"^([0-9]{2})([-/])([0-9]{2})\2([0-9]{4})$")


def _normalized_csv_date(value: str) -> str | None:
    """Return an ISO-formatted date candidate or None for unsupported syntax."""
    iso = ISO_DATE_CSV_PATTERN.fullmatch(value)
    if iso:
        return f"{iso[1]}-{iso[3]}-{iso[4]}"
    us = US_DATE_CSV_PATTERN.fullmatch(value)
    if us:
        return f"{us[4]}-{us[1]}-{us[3]}"
    return None


def _error(row: int, field: str, message: str) -> dict:
    """Return a field location and controlled guidance, never raw DRF text."""
    return {"row": row, "field": field, "message": message}


def _choice_error(field: str, raw: str) -> str:
    """Explain allowed choices without reflecting long or sensitive cells."""
    choices = ", ".join(CHOICE_FIELDS[field])
    prefix = (
        f'"{raw.strip()}" is not recognized. '
        if DISPLAYABLE_CHOICE.fullmatch(raw.strip()) else ""
    )
    optional = " Leave blank if unknown." if field != "status" else ""
    return f"{prefix}Use one of: {choices}.{optional}"


def _serializer_error(field: str, codes: list[str]) -> str:
    """Translate validation codes to user actions without returning input or exception text."""
    if field in CHOICE_FIELDS:
        if field == "status" and any(code in ("blank", "required", "null") for code in codes):
            return f"Status is required. Use one of: {', '.join(CHOICE_FIELDS[field])}."
        return _choice_error(field, "")
    if field == "email":
        return "Enter a valid email address or leave blank if unknown."
    if field in DATE_FIELDS:
        # Syntax and calendar validity are checked before DRF; an end_date
        # error here can only mean it precedes a supplied start_date.
        if field == "end_date":
            return "End date cannot precede start date."
        return ("Use a real date in YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY "
                "or MM-DD-YYYY; or leave blank.")
    if field in MONEY_FIELDS:
        return "Use a nonnegative amount with at most two decimal places; or leave blank."
    if field in ("first_name", "last_name", "membership_type"):
        return "This field is required; enter a nonblank value."
    if field == "row":
        return "Check the dates and required fields in this row."
    return "Check this field's format or leave it blank if unknown."


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
            # A separate normalized row leaves the original CSV untouched; the
            # serializer and batch fingerprint see identical facts for Excel/ISO dates.
            normalized_row = row.copy()
            for field, value in row.items():
                if len(value) > MEMBERSHIP_CSV_FIELD_LIMITS[field]:
                    result["errors"].append(_error(
                        row_number, field,
                        f"Use at most {MEMBERSHIP_CSV_FIELD_LIMITS[field]} characters.",
                    ))
                    invalid_fields.add(field)
                elif field in CHOICE_FIELDS and value.strip():
                    # Only CSV choice labels are case-insensitive. Normalize before
                    # serializer validation and fingerprinting, so re-uploading
                    # 'Active' cannot create another batch for 'active'.
                    candidate = value.strip().lower()
                    if candidate in CHOICE_FIELDS[field]:
                        normalized_row[field] = candidate
                    else:
                        result["errors"].append(_error(
                            row_number, field, _choice_error(field, value),
                        ))
                        invalid_fields.add(field)
                elif field in DATE_FIELDS and value.strip():
                    normalized_date = _normalized_csv_date(value)
                    if normalized_date is None:
                        result["errors"].append(_error(
                            row_number, field,
                            "Use YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY or MM-DD-YYYY; or leave blank.",
                        ))
                        invalid_fields.add(field)
                    else:
                        try:
                            date.fromisoformat(normalized_date)
                        except ValueError:
                            result["errors"].append(_error(
                                row_number, field, "Use a real calendar date; or leave blank.",
                            ))
                            invalid_fields.add(field)
                            continue
                        normalized_row[field] = normalized_date
                elif (field in MONEY_FIELDS and value.strip()
                      and not DECIMAL_CSV_PATTERN.fullmatch(value)):
                    guidance = (
                        "This amount looks like a spreadsheet date. Restore the intended numeric "
                        "amount in the source file, or leave blank if unknown."
                        if SPREADSHEET_DATE_SHAPE.fullmatch(value.strip()) else
                        "Use a nonnegative amount with at most two decimal places; "
                        "no symbols, separators or signs. Leave blank if unknown."
                    )
                    result["errors"].append(_error(
                        row_number, field, guidance,
                    ))
                    invalid_fields.add(field)
            # Validate other cells even if a CSV-format check already failed.
            # Omit invalid optional fields (manual rules treat them as unknown)
            # and supply a harmless valid required value only for diagnostics.
            diagnostic_row = {
                key: ("valid" if key in invalid_fields and key in
                      ("first_name", "last_name", "membership_type") else value)
                for key, value in normalized_row.items() if key not in invalid_fields or key in
                ("first_name", "last_name", "membership_type")
            }
            serializer = ManualMembershipCreateSerializer(
                data=membership_csv_manual_input(diagnostic_row),
            )
            if not serializer.is_valid():
                for field, details in serializer.errors.items():
                    # DRF's free-text messages can contain uploaded values. Use
                    # only stable error codes to choose safe, actionable guidance.
                    safe_field = field if field in MEMBERSHIP_CSV_HEADERS else "row"
                    if safe_field not in invalid_fields:
                        codes = (
                            [str(item.code) for item in details]
                            if isinstance(details, list) else []
                        )
                        if safe_field == "status" and not row["status"].strip():
                            codes.append("required")
                        result["errors"].append(_error(
                            row_number, safe_field, _serializer_error(safe_field, codes),
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
