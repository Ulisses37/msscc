from donations.models import Membership
from donations.search import normalize_search_text


def _row_identity(values: dict) -> tuple:
    """Compare all interpreted facts, retaining the distinction between null and zero."""
    from donations.membership_csv_contract import MEMBERSHIP_CSV_HEADERS

    # The parser has already normalized valid input through the manual serializer.
    # Keeping every template field in the key avoids calling two different
    # historical payments duplicates merely because names or emails match.
    return tuple(values[field] for field in MEMBERSHIP_CSV_HEADERS)


def repeated_membership_warnings(proposals: list[dict]) -> list[dict]:
    """Warn on later identical validated rows; never silently discard either row."""
    first_rows = {}
    warnings = []
    for proposal in proposals:
        identity = _row_identity(proposal["values"])
        # setdefault retains the first CSV row even when three or more rows match.
        # Only later rows are warned, but every row remains in the proposal list.
        first_row = first_rows.setdefault(identity, proposal["row"])
        if first_row != proposal["row"]:
            warnings.append({
                "row": proposal["row"], "reason": "repeated_row",
                "message": f"Same validated facts as CSV row {first_row}; review both rows.",
            })
    return warnings


def existing_membership_warnings(proposals: list[dict]) -> list[dict]:
    """Use reference or name/type/start-date evidence, never email alone."""
    warnings = []
    for proposal in proposals:
        values = proposal["values"]
        reference = values["reference_id"]
        if reference:
            # A supplied nonblank reference is stronger evidence than an email.
            # Blank references are not evidence: multiple historical records
            # legitimately have no reference at all.
            if Membership.objects.filter(reference_id=reference).exists():
                warnings.append({
                    "row": proposal["row"], "reason": "existing_reference",
                    "message": "A saved membership has the same reference; review before saving.",
                })
        if not values["start_date"]:
            # A missing date cannot be treated as today's date or as proof that
            # two memberships with the same name cover the same membership year.
            continue
        # Encrypted names cannot be queried with database equality. Narrow by
        # the supplied date, then compare normalized names AND type after the
        # view has checked finance permission. Do not fetch emails or addresses.
        candidates = Membership.objects.filter(
            start_date=values["start_date"],
        ).only("first_name_encrypted", "last_name_encrypted", "membership_type")
        first_name = normalize_search_text(values["first_name"])
        last_name = normalize_search_text(values["last_name"])
        membership_type = normalize_search_text(values["membership_type"])
        if any(
            normalize_search_text(candidate.membership_type) == membership_type
            and normalize_search_text(candidate.first_name_encrypted) == first_name
            and normalize_search_text(candidate.last_name_encrypted) == last_name
            for candidate in candidates.iterator(chunk_size=100)
        ):
            # Return a reason, not the candidate's private contact data. This
            # is a possible match for review, never an instruction to merge.
            warnings.append({
                "row": proposal["row"], "reason": "existing_identity_date",
                "message": "A saved membership has the same name, type and start date; review it.",
            })
    return warnings


def membership_duplicate_warnings(proposals: list[dict]) -> list[dict]:
    """Collect independent, explained warnings without editing proposed rows."""
    # Both checks may flag the same row for different reasons; preserve both
    # so the reviewer knows why the later confirmation must recheck warnings.
    return repeated_membership_warnings(proposals) + existing_membership_warnings(proposals)
