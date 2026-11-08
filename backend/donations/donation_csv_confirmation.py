"""Bind reviewed donation facts to one authorized, atomic import decision."""

import json

from django.core import signing
from django.db import transaction
from django.utils.crypto import salted_hmac

from donations.donation_csv_duplicates import donation_duplicate_warnings
from donations.manual_donations import create_manual_donation
from donations.models import DonationImportBatch

TOKEN_SALT = "donations.donation-csv-confirmation.v1"
TOKEN_LIFETIME_SECONDS = 15 * 60


def batch_fingerprint(proposals: list[dict]) -> str:
    """Uniquely identify ordered, normalized facts, not Excel's cell formatting."""
    canonical = json.dumps(
        [proposal["values"] for proposal in proposals],
        sort_keys=True, ensure_ascii=False, separators=(",", ":"),
    )
    # A plain digest of names and historical dates is guessable if leaked;
    # use a distinct server-keyed domain from membership batches and tokens.
    return salted_hmac("donation-csv-batch.v1", canonical).hexdigest()


def warning_identity(warnings: list[dict]) -> list[list]:
    """Bind row/reason evidence without embedding donors' private facts."""
    return [[item["row"], item["reason"]] for item in warnings]


def make_review_token(raw: bytes, preview: dict, user_id: int) -> str:
    """Sign the reviewer, exact uploaded bytes, facts and warning set."""
    return signing.dumps({
        "user": user_id,
        "file": salted_hmac("donation-csv-file.v1", raw).hexdigest(),
        "fingerprint": batch_fingerprint(preview["proposed_records"]),
        "warnings": warning_identity(preview["warnings"]),
    }, salt=TOKEN_SALT)


def read_review_token(token: str) -> tuple[dict | None, bool]:
    """Expired reviews may recover committed receipts, never authorize a save."""
    try:
        return signing.loads(token, salt=TOKEN_SALT, max_age=TOKEN_LIFETIME_SECONDS), False
    except signing.SignatureExpired:
        try:
            return signing.loads(token, salt=TOKEN_SALT), True
        except signing.BadSignature:
            return None, False
    except signing.BadSignature:
        return None, False


def batch_result(batch: DonationImportBatch, *, already_imported: bool) -> dict:
    """Return a receipt without echoing uploaded or saved donor information."""
    return {
        "record_type": "donation", "batch_id": str(batch.pk),
        "created_count": batch.donations.count(),
        "donation_ids": list(batch.donations.order_by("pk").values_list("pk", flat=True)),
        "already_imported": already_imported,
    }


def confirm_review(proposals: list[dict], fingerprint: str, warnings: list[list],
                   acknowledged: bool, user) -> tuple[dict | None, str | None]:
    """Reserve the fingerprint, recheck warnings, then save all rows or none."""
    with transaction.atomic():
        # A lost-response retry must win before its own rows appear as new
        # matches. The unique database key also arbitrates competing workers.
        existing = DonationImportBatch.objects.filter(fingerprint=fingerprint).first()
        if existing:
            return batch_result(existing, already_imported=True), None

        # Reserve the key BEFORE checking current warnings. If another worker
        # has just committed the same batch, return its receipt rather than
        # rejecting on warnings caused by those very donations. On rejection,
        # roll back the provisional receipt alongside any attempted writes.
        batch, created = DonationImportBatch.objects.get_or_create(
            fingerprint=fingerprint, defaults={"created_by": user},
        )
        if not created:
            return batch_result(batch, already_imported=True), None
        current = donation_duplicate_warnings(proposals)
        if warning_identity(current) != warnings:
            transaction.set_rollback(True)
            return None, "Donation warnings changed. Review the CSV again before confirming."
        if current and not acknowledged:
            transaction.set_rollback(True)
            return None, "Acknowledge the donation warnings before confirming."
        for proposal in proposals:
            # Reuse the already-received manual path for encryption, anonymous
            # privacy and completed status. Provenance is backend-owned.
            create_manual_donation(proposal["values"], import_batch=batch)
        return batch_result(batch, already_imported=False), None
