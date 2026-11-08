"""Explain possible donation duplicates without merging or exposing saved contacts."""

from donations.donation_csv_contract import DONATION_CSV_HEADERS
from donations.models import Donation
from donations.search import normalize_search_text


def repeated_donation_warnings(proposals: list[dict]) -> list[dict]:
    """Flag later copies of every identical set of normalized CSV facts."""
    first_rows = {}
    warnings = []
    for proposal in proposals:
        # All columns matter: two gifts on the same day from the same person
        # can be legitimate. Keep amount, notes, payment method and nulls distinct.
        identity = tuple(proposal["values"][field] for field in DONATION_CSV_HEADERS)
        first_row = first_rows.setdefault(identity, proposal["row"])
        if first_row != proposal["row"]:
            warnings.append({
                "row": proposal["row"], "reason": "repeated_row",
                "message": f"Same validated facts as CSV row {first_row}; review both donations.",
            })
    return warnings


def existing_donation_warnings(proposals: list[dict]) -> list[dict]:
    """Use amount/date plus reference or known names, never matching email alone."""
    warnings = []
    for proposal in proposals:
        values = proposal["values"]
        # An external ledger reference by itself can recur across separate
        # gifts. Narrow to a known amount and date before warning.
        candidates = Donation.objects.filter(
            donation_date=values["donation_date"], amount=values["amount"],
        )
        reference = normalize_search_text(values["external_reference"])
        if reference and any(
            normalize_search_text(candidate.external_reference) == reference
            for candidate in candidates.only("external_reference").iterator(chunk_size=100)
        ):
            warnings.append({
                "row": proposal["row"], "reason": "existing_reference_amount_date",
                "message": (
                    "A saved donation shares the ledger reference, amount and date; review it."
                ),
            })

        # Anonymous imports and unknown names cannot claim a donor-identity
        # match. Narrow the database query by amount/date and stream names in
        # fixed-size chunks for authorized Python-side comparison; never query
        # or return saved email/address for this test.
        first = normalize_search_text(values["donor_first_name"])
        last = normalize_search_text(values["donor_last_name"])
        if not values["is_anonymous"] and first and last and any(
            normalize_search_text(candidate.donor_first_name_encrypted) == first
            and normalize_search_text(candidate.donor_last_name_encrypted) == last
            and not candidate.is_anonymous
            for candidate in candidates.only(
                "donor_first_name_encrypted", "donor_last_name_encrypted", "is_anonymous",
            ).iterator(chunk_size=100)
        ):
            warnings.append({
                "row": proposal["row"], "reason": "existing_name_amount_date",
                "message": "A saved donation shares the donor name, amount and date; review it.",
            })
    return warnings


def donation_duplicate_warnings(proposals: list[dict]) -> list[dict]:
    """Report independent evidence without discarding or changing any row."""
    return repeated_donation_warnings(proposals) + existing_donation_warnings(proposals)
