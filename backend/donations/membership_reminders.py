"""Select membership records that are due an expiry reminder.

Eligibility is deliberately structural rather than name-based. A membership is
selected when its stored ``end_date`` falls inside the reminder window, which is
what excludes lifetime members: every write path that records a non-expiring
membership leaves ``end_date`` null. ``membership_type`` is unvalidated free
text, so matching "life" or "lifetime" in it would be a second, drift-prone
definition of the same idea.

``status`` and ``payment_status`` are free text too, so they are filtered with
denylists. An allowlist would drop the historical members this project records
as ``unknown``, and ``payment_status`` is null for most manually entered and
imported rows.

Email addresses are stored as ciphertext, so no database lookup can compare
them. Anything that has to look at an address, including the superseded-member
guard, does so in Python after the field decrypts on read.

The same-email dedupe is best effort under concurrent runs. Two runs that
overlap can each select a different sibling row of the same member, and because
they claim different rows there is no shared row for the conditional update to
arbitrate on, so both can send. The per-row claim prevents a double send for one
row; only a real member identity would make the per-member rule airtight.
"""

import logging
from dataclasses import dataclass, field
from datetime import date, timedelta

from django.core.validators import validate_email
from django.utils import timezone

from donations.models import Membership

logger = logging.getLogger(__name__)

# How far ahead of its end_date a membership becomes eligible for a reminder.
# A window rather than an exact day means one missed run does not skip anyone.
REMINDER_WINDOW = timedelta(days=14)

# Statuses that mean an admin has already ended, cancelled or not yet started
# this membership, so a renewal nudge would be wrong. Both spellings of
# cancelled are listed because the value is unvalidated free text and the admin
# UI already treats them as the same state.
CANCELLED_STATUSES = frozenset({
    "inactive", "canceled", "cancelled", "expired", "pending",
})

# Payment states that rule a membership out. Only the explicitly failed ones:
# null, waived, completed and pending all remain eligible, because a null
# payment_status is the documented norm for imported and manual records.
BLOCKED_PAYMENT_STATUSES = frozenset({"failed", "canceled"})

# Decrypts every eligible row, so the selector keeps the read narrow.
SELECTOR_FIELDS = (
    "membership_id",
    "end_date",
    "status",
    "payment_status",
    "expiry_reminder_for",
    "first_name_encrypted",
    "email_encrypted",
)


def _normalized(value: object) -> str:
    """Return a stripped, casefolded comparison form for a free-text field."""
    return str(value).strip().casefold() if value is not None else ""


def is_cancelled_status(value: object) -> bool:
    """Report whether a membership status means the term is not current.

    Shared by the selector and the superseded-member guard so the two cannot
    drift apart on which statuses count as ended.
    """
    return _normalized(value) in CANCELLED_STATUSES


def is_blocked_payment_status(value: object) -> bool:
    """Report whether a payment state rules a membership out of reminders."""
    return _normalized(value) in BLOCKED_PAYMENT_STATUSES


def normalize_email(value: object) -> str:
    """Return the comparison form used to treat two rows as the same member."""
    return _normalized(value)


def is_sendable_email(value: object) -> bool:
    """Report whether a decrypted address is one worth attempting a send to.

    Imported data can contain a malformed address. Rejecting it here keeps a few
    bad rows from sitting at the front of the order and tripping the command's
    failure circuit breaker on every run.
    """
    address = _normalized(value)
    if not address:
        return False
    try:
        validate_email(address)
    except Exception:
        return False
    return True


@dataclass(frozen=True)
class ReminderSelection:
    """The members to remind, plus a count of the rows the selector dropped.

    ``skipped`` exists so the management command can report how many rows were
    left out for reasons that are not an error, such as a missing or malformed
    address. It is deliberately a bare count: an address never reaches a log
    line or a response body. The other exclusions (cancelled status, failed
    payment, already reminded, superseded term) are ordinary business rules and
    are not counted here.
    """

    members: list = field(default_factory=list)
    skipped: int = 0


def select_members_due_for_reminder(
    today: date | None = None, days: int | None = None
) -> ReminderSelection:
    """Return the members to remind and the count of addressless rows skipped.

    ``days`` overrides ``REMINDER_WINDOW`` so the management command's
    ``--days-before`` actually changes who is selected. ``today`` defaults to
    the date in the project's configured timezone. ``members`` is ordered by
    ``end_date`` then primary key, so a caller that applies a limit always
    reminds the most-imminent expiries first.
    """
    window = REMINDER_WINDOW if days is None else timedelta(days=days)
    start = today or timezone.localdate()
    end = start + window

    candidates = list(
        Membership.objects.filter(
            end_date__isnull=False,
            end_date__gte=start,
            end_date__lte=end,
            email_encrypted__isnull=False,
        )
        .exclude(status__in=CANCELLED_STATUSES)
        .exclude(payment_status__in=BLOCKED_PAYMENT_STATUSES)
        .only(*SELECTOR_FIELDS)
        .order_by("end_date", "membership_id")
    )

    ready = []
    skipped = 0
    for membership in candidates:
        # The queryset's status/payment filters are exact matches; a differently
        # cased or padded stored value only gets caught by the shared helpers.
        if is_cancelled_status(membership.status):
            continue
        if is_blocked_payment_status(membership.payment_status):
            continue
        # A row with no usable address is not an error, but it is worth
        # reporting, so it is counted rather than silently discarded.
        if not is_sendable_email(membership.email_encrypted):
            skipped += 1
            continue
        ready.append(membership)

    return ReminderSelection(
        members=_drop_superseded_and_duplicated(ready), skipped=skipped
    )


def _drop_superseded_and_duplicated(candidates: list) -> list:
    """Keep one reminder per member and expiry, and skip already-renewed rows.

    A member is identified by normalized email. Two different rows can carry the
    same address (a second checkout, a CSV import beside a manual record) and
    there is no unique constraint on the address, so this has to be decided
    here. The guard is best effort: legacy rows with a blank or differently
    formatted address are not matched.
    """
    by_email: dict[str, list] = {}
    for membership in candidates:
        by_email.setdefault(normalize_email(membership.email_encrypted), []).append(membership)

    kept = []
    for siblings in by_email.values():
        # A later end_date means the member already holds a term that runs
        # beyond this one, so this row is a superseded record rather than an
        # expiring membership. Only rows that are themselves still live count as
        # evidence of a renewal: a cancelled or failed row must not suppress a
        # reminder for a term that is genuinely ending.
        live_ends = [
            sibling.end_date
            for sibling in siblings
            if not is_cancelled_status(sibling.status)
            and not is_blocked_payment_status(sibling.payment_status)
        ]
        highest = max(live_ends) if live_ends else None

        # An expiry is claimed as a whole, not row by row. If any row sharing
        # this expiry has already been reminded for it, then this member has had
        # their reminder for that date, so every other row with the same expiry
        # is skipped too. Without that, the representative would be emailed on
        # day one and a sibling would be emailed on day two for the same term.
        # The check lives here rather than in the queryset loop because only
        # here are the sibling rows still visible: the reminded row is a
        # legitimate candidate in its own right and must not be filtered out
        # before it can mark the expiry as spoken for.
        reminded_expiries = {
            sibling.end_date
            for sibling in siblings
            if sibling.expiry_reminder_for == sibling.end_date
        }

        seen_expiries = set()
        for membership in siblings:
            if highest is not None and membership.end_date < highest:
                continue
            if membership.end_date in reminded_expiries:
                continue
            # Same email and same end_date collapses to a single reminder.
            if membership.end_date in seen_expiries:
                continue
            seen_expiries.add(membership.end_date)
            kept.append(membership)

    kept.sort(key=lambda membership: (membership.end_date, membership.membership_id))
    return kept


# Sentinel returned by the claim helper when another run already holds the claim.
# A plain ``None`` cannot carry that meaning, because None is also the legitimate
# previous value for a member who has never been reminded.
CLAIM_LOST = object()


def claim_member_for_reminder(membership, expiry_date: date):
    """Reserve this member's expiry for sending, returning the previous value.

    Returns the value ``expiry_reminder_for`` held before the claim, so the
    caller passes exactly that back to ``release_member_claim`` and can never
    release a claim it did not win. Returns ``CLAIM_LOST`` when another run
    already holds the claim for this expiry, which the caller must treat as
    "skip this member", not as "send anyway".

    The claim is taken before the send so two overlapping runs cannot both mail
    the same member: the conditional update only matches while
    ``expiry_reminder_for`` still differs from the expiry date, so exactly one
    caller can win. The tradeoff is documented on the command: a crash between
    the claim and the send skips that reminder until the next cycle.
    """
    previous = membership.expiry_reminder_for
    claimed = (
        Membership.objects.filter(pk=membership.pk, end_date=expiry_date)
        .exclude(expiry_reminder_for=expiry_date)
        .update(expiry_reminder_for=expiry_date)
    )
    if not claimed:
        return CLAIM_LOST

    membership.expiry_reminder_for = expiry_date
    return previous


def release_member_claim(membership, claimed_expiry: date, previous_value: date | None) -> None:
    """Give the claim back after a failed send so the next run retries it.

    ``claimed_expiry`` is the value a successful claim wrote, and
    ``previous_value`` is what the claim helper returned. The update is filtered
    on ``claimed_expiry``, so it only ever undoes a claim for that expiry and a
    release aimed at any other value changes nothing.

    It cannot tell which call wrote that value, because a claim always writes the
    same date. The caller therefore has to skip a ``CLAIM_LOST`` result rather
    than release it: releasing an expiry this run did not win would undo the
    claim another run is actively using.
    """
    Membership.objects.filter(
        pk=membership.pk, expiry_reminder_for=claimed_expiry
    ).update(expiry_reminder_for=previous_value)
    membership.expiry_reminder_for = previous_value
