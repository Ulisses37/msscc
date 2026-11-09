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

from django.conf import settings
from django.core.validators import validate_email
from django.utils import timezone

from donations.models import Membership

logger = logging.getLogger(__name__)

# How many consecutive provider failures end the run. A provider that is down
# will fail every remaining member, so stopping early keeps one outage from
# burning through the whole list and the daily send cap.
MAX_CONSECUTIVE_FAILURES = 5

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
    # Read before the update, because the update overwrites the field. This
    # value is only for the caller to hand back to release_member_claim; it is
    # the conditional update below, not this read, that makes the claim safe
    # against a concurrent run.
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


@dataclass
class ReminderRunTally:
    """What one reminder run did, in the shape the command and endpoint report.

    ``skipped`` counts rows the selector could not attempt because they had no
    usable address. ``limit_reached`` means more eligible members remained than
    the run was allowed to attempt. ``aborted`` means the failure circuit
    breaker ended the run early.
    """

    sent: int = 0
    skipped: int = 0
    failed: int = 0
    limit: int = 0
    limit_reached: bool = False
    disabled: bool = False
    aborted: bool = False
    # Only set by a dry run: the primary keys of the members it would have
    # reminded. Primary keys only, so a preview cannot leak an address.
    would_remind: list = field(default_factory=list)

    def as_dict(self) -> dict:
        """Return the JSON-ready form, which is what the endpoint returns."""
        return {
            "sent": self.sent,
            "skipped": self.skipped,
            "failed": self.failed,
            "limit": self.limit,
            "limit_reached": self.limit_reached,
            "disabled": self.disabled,
            "aborted": self.aborted,
            "would_remind": self.would_remind,
        }


def run_membership_expiry_reminders(
    *, days: int | None = None, limit: int = 50, dry_run: bool = False
) -> ReminderRunTally:
    """Send the expiry reminders, returning a tally of what happened.

    Shared by the management command and the trigger endpoint so both report the
    same numbers. ``dry_run`` reports who would be reminded without claiming or
    sending, and deliberately ignores ``MEMBERSHIP_REMINDERS_ENABLED`` so the
    list can be reviewed before the feature is switched on. A real run respects
    the flag and returns ``disabled`` when it is off.

    Each member is handled in one guarded block that knows whether this run holds
    the claim, so a failure can give the claim back and leave the member
    eligible for the next run. Delivery is at most once per expiry: a crash
    between the claim and the send skips that member until the next cycle.
    """
    tally = ReminderRunTally(limit=limit)

    if not dry_run and not settings.MEMBERSHIP_REMINDERS_ENABLED:
        tally.disabled = True
        return tally

    selection = select_members_due_for_reminder(days=days)
    tally.skipped = selection.skipped
    candidates = selection.members

    if dry_run:
        # Counted, never claimed or sent. Only primary keys are reported, so a
        # preview can never leak an address into a log or a response.
        tally.limit_reached = len(candidates) > limit
        tally.would_remind = [membership.pk for membership in candidates[:limit]]
        return tally

    consecutive_failures = 0
    for index, membership in enumerate(candidates):
        if index >= limit:
            # Applied after the guard and dedupe, so the limit counts send
            # attempts against the members that were actually eligible.
            tally.limit_reached = True
            break
        if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
            tally.aborted = True
            break

        outcome = _remind_one(membership, tally)
        if outcome:
            consecutive_failures = 0
        else:
            consecutive_failures += 1

    if tally.aborted:
        # Count and exception class only: no address and no provider text.
        logger.error(
            "Membership reminder run aborted after %s consecutive failures.",
            consecutive_failures,
        )

    return tally


def _remind_one(membership, tally: ReminderRunTally) -> bool:
    """Build, claim, send and release one reminder. Returns whether it sent.

    The message is built before the claim on purpose. Building after claiming
    would let a template error leave a claim recorded for a message that never
    went out, and the member would then be skipped for the rest of the cycle.
    """
    from emails.messages import (  # noqa: PLC0415
        build_membership_expiry_reminder,
        send_membership_expiry_reminder,
    )

    expiry = membership.end_date
    try:
        subject, html = build_membership_expiry_reminder(membership)
    except Exception as exc:
        # Nothing was claimed, so there is nothing to release.
        tally.failed += 1
        logger.error("Membership reminder failed. %s", type(exc).__name__)
        return False

    claimed_previous = claim_member_for_reminder(membership, expiry)
    if claimed_previous is CLAIM_LOST:
        # Another run holds this member's expiry, so this run must not send.
        # It also must not release: the claim belongs to someone else.
        return False

    try:
        send_membership_expiry_reminder(
            to=membership.email_encrypted,
            subject=subject,
            html=html,
            raise_on_failure=True,
        )
    except Exception as exc:
        # The send, or anything between the claim and it, failed. Give the claim
        # back so the next run retries this member.
        release_member_claim(membership, expiry, claimed_previous)
        tally.failed += 1
        logger.error("Membership reminder failed. %s", type(exc).__name__)
        return False

    tally.sent += 1
    return True
