"""Bind read-only CSV review to one atomic, repeatable import decision."""

import json

from django.core import signing
from django.db import transaction
from django.utils.crypto import salted_hmac

from donations.manual_memberships import create_manual_membership
from donations.membership_csv_duplicates import membership_duplicate_warnings
from donations.models import MembershipImportBatch

TOKEN_SALT = "donations.membership-csv-confirmation.v1"
TOKEN_LIFETIME_SECONDS = 15 * 60


def batch_fingerprint(proposals: list[dict]) -> str:
    """Identify the ordered, normalized facts, not superficial CSV formatting."""
    payload = [proposal["values"] for proposal in proposals]
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    # A plain digest of low-entropy names/dates could be guessed from a leaked
    # database. Key this stable fingerprint with the server secret instead.
    return salted_hmac("membership-csv-batch.v1", canonical).hexdigest()


def warning_identity(warnings: list[dict]) -> list[list]:
    """Sign stable warning evidence, never uploaded contact data."""
    return [[warning["row"], warning["reason"]] for warning in warnings]


def make_review_token(raw: bytes, preview: dict, user_id: int) -> str:
    """Bind a review to its owner, exact bytes, normalized facts and warnings."""
    return signing.dumps({
        "user": user_id,
        "file": salted_hmac("membership-csv-file.v1", raw).hexdigest(),
        "fingerprint": batch_fingerprint(preview["proposed_records"]),
        "warnings": warning_identity(preview["warnings"]),
    }, salt=TOKEN_SALT)


def read_review_token(token: str) -> tuple[dict | None, bool]:
    """Expired tokens can identify a committed retry, never authorize a new save."""
    try:
        return signing.loads(token, salt=TOKEN_SALT, max_age=TOKEN_LIFETIME_SECONDS), False
    except signing.SignatureExpired:
        try:
            return signing.loads(token, salt=TOKEN_SALT), True
        except signing.BadSignature:
            return None, False
    except signing.BadSignature:
        return None, False


def batch_result(batch: MembershipImportBatch, *, already_imported: bool) -> dict:
    """Return only committed identifiers, not the uploaded private contact data."""
    return {
        "record_type": "membership", "batch_id": str(batch.pk),
        "created_count": batch.memberships.count(),
        "membership_ids": list(batch.memberships.order_by("pk").values_list("pk", flat=True)),
        "already_imported": already_imported,
    }


def confirm_review(proposals: list[dict], fingerprint: str, warnings: list[list],
                   acknowledged: bool, user) -> tuple[dict | None, str | None]:
    """Recheck warnings and persist all rows or none, under a unique batch key."""
    with transaction.atomic():
        # First check the unique key: a lost-response retry must not be blocked
        # by warnings caused by the very rows it just created.
        existing = MembershipImportBatch.objects.filter(fingerprint=fingerprint).first()
        if existing:
            return batch_result(existing, already_imported=True), None

        # The unique constraint arbitrates concurrent transactions on Postgres:
        # reserve the key BEFORE checking current warnings. Otherwise a losing
        # request could see the winner's new rows and reject a valid retry as
        # stale instead of returning its committed receipt. A rejected review
        # marks the transaction for rollback so the provisional batch vanishes.
        batch, created = MembershipImportBatch.objects.get_or_create(
            fingerprint=fingerprint, defaults={"created_by": user},
        )
        if not created:
            return batch_result(batch, already_imported=True), None
        current = membership_duplicate_warnings(proposals)
        if warning_identity(current) != warnings:
            transaction.set_rollback(True)
            return None, "Membership warnings changed. Review the CSV again before confirming."
        if current and not acknowledged:
            transaction.set_rollback(True)
            return None, "Acknowledge the membership warnings before confirming."
        for proposal in proposals:
            create_manual_membership(proposal["values"], import_batch=batch)
        return batch_result(batch, already_imported=False), None
