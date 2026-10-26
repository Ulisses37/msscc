"""Volunteer change detection and notification.

Only material changes notify a volunteer: a shift that was removed, a shift that
moved (date, time or location), or a shift whose role changed. Everything else,
including a plain re-save, is silent.

Changes are collected while one request or transaction runs and coalesced per
(volunteer, event), so several edits in one save produce one email that lists the
final state. The collection is flushed once per commit through
``transaction.on_commit``. Entries are re-validated against the database at flush
time, which is what keeps a rolled-back edit from emailing anyone.
"""

import logging
import threading
from dataclasses import dataclass, field

from django.db import transaction

from events.models import Event, VolunteerSignup, VolunteerSlot

logger = logging.getLogger(__name__)

# Change kinds. These are the only reasons a volunteer is notified.
REMOVED = "removed"
MOVED = "moved"
ROLE_CHANGED = "role_changed"

# Fields whose change is material for each model. Used both to compare snapshots
# and to decide whether an ``update_fields`` save can possibly matter.
SLOT_TRACKED_FIELDS = ("start_datetime", "end_datetime", "position_name")
EVENT_TRACKED_FIELDS = ("start_datetime", "end_datetime", "location_en")


@dataclass
class _Change:
    """One detected change, already reduced to the values an email displays."""

    kind: str
    details: dict = field(default_factory=dict)


# The buffer is thread-local: two requests in the same process must never share
# or drain each other's pending notifications.
_pending = threading.local()


def _buffer() -> dict:
    """Return this thread's pending changes, keyed by (signup, event)."""
    if not hasattr(_pending, "changes"):
        _pending.changes = {}
    return _pending.changes


def take_pending_changes() -> dict:
    """Take the pending changes, leaving the buffer empty.

    Public so the tests can inspect what was collected without sending anything.
    """
    changes = _buffer()
    taken = dict(changes)
    changes.clear()
    return taken


def record_slot_removed(signups: list, event: dict) -> None:
    """Record that a shift was removed for each of ``signups``.

    ``signups`` and ``event`` are plain values captured before the delete, not
    model instances: a cascading ``Event`` delete has already removed those rows
    by the time this runs.
    """
    for signup in signups:
        _record(
            signup["volunteer_signup_id"],
            event["event_id"],
            _Change(
                kind=REMOVED,
                details={
                    "volunteer_signup_id": signup["volunteer_signup_id"],
                    "first_name": signup["first_name"],
                    "email": signup["email"],
                    "slot_id": signup["slot_id"],
                    "event_id": event["event_id"],
                    "event_name": event["title_en"],
                    "role": signup["position_name"],
                    "start_datetime": signup["start_datetime"],
                    "end_datetime": signup["end_datetime"],
                },
            ),
        )


def record_slot_changed(slot: VolunteerSlot, before: dict) -> None:
    """Record a move and/or a role change for a slot that was just saved."""
    changes = _slot_changes(slot, before)
    if not changes:
        return

    for signup in _signups_for_slot(slot):
        for change in changes:
            _record(signup.volunteer_signup_id, slot.event_id, _change_for_signup(change, signup))


def record_event_changed(event: Event, before: dict) -> None:
    """Record a move for every volunteer on the event the edit touched."""
    changes = _event_changes(event, before)
    if not changes:
        return

    for slot in event.slots.all():
        for signup in _signups_for_slot(slot):
            for change in changes:
                _record(
                    signup.volunteer_signup_id,
                    event.event_id,
                    _change_for_signup(change, signup),
                )


def record_signup_reassigned(signup: VolunteerSignup, before: dict) -> None:
    """Record a move when a signup is pointed at a different slot.

    Moving between slots never counts as the old shift being removed: the shift
    still exists, the volunteer just moved to another one. Only a difference in
    date or time is material, because a swap between two identical shifts leaves
    the volunteer with nothing new to know.
    """
    if signup.slot_id is None or signup.slot_id == before.get("slot_id"):
        return

    slot = signup.slot
    previous = before.get("slot")
    if previous is None:
        return
    if (
        slot.start_datetime == previous["start_datetime"]
        and slot.end_datetime == previous["end_datetime"]
    ):
        return

    _record(
        signup.volunteer_signup_id,
        slot.event_id,
        _change_for_signup(
            _Change(
                kind=MOVED,
                details={
                    "new_start_datetime": slot.start_datetime,
                    "new_end_datetime": slot.end_datetime,
                    "new_location": slot.event.location_en,
                    "new_role": slot.position_name,
                },
            ),
            signup,
        ),
    )


def snapshot(model_instance, tracked_fields: tuple, update_fields=None) -> dict | None:
    """Return the stored values of ``tracked_fields``, or ``None`` if unknown.

    The row is read before the save, so this is the only way to learn what the
    previous values were. A save that declares ``update_fields`` untouched by the
    tracked fields cannot have changed them, so the query is skipped entirely.
    That is what keeps the ``volunteer_slots`` bookkeeping save in
    ``update_event_volunteer_slots`` from querying on every slot edit.
    """
    if model_instance.pk is None:
        return {}

    if update_fields is not None and not set(update_fields).intersection(tracked_fields):
        return None

    stored = type(model_instance).objects.filter(pk=model_instance.pk).first()
    if stored is None:
        return {}

    return {name: getattr(stored, name) for name in tracked_fields}


def _slot_changes(slot: VolunteerSlot, before: dict) -> list:
    """Return the material differences between a slot and its stored values."""
    changes = []

    if (
        slot.start_datetime != before.get("start_datetime")
        or slot.end_datetime != before.get("end_datetime")
    ):
        changes.append(
            _Change(
                kind=MOVED,
                details={
                    "new_start_datetime": slot.start_datetime,
                    "new_end_datetime": slot.end_datetime,
                    "new_location": slot.event.location_en,
                    "new_role": slot.position_name,
                },
            )
        )

    if slot.position_name != before.get("position_name"):
        changes.append(
            _Change(
                kind=ROLE_CHANGED,
                details={
                    "new_role": slot.position_name,
                    "old_role": before.get("position_name"),
                    "new_location": slot.event.location_en,
                },
            )
        )

    return changes


def _event_changes(event: Event, before: dict) -> list:
    """Return a move when the event's date, time or location changed."""
    if (
        event.start_datetime != before.get("start_datetime")
        or event.end_datetime != before.get("end_datetime")
        or event.location_en != before.get("location_en")
    ):
        return [
            _Change(
                kind=MOVED,
                details={
                    "new_start_datetime": event.start_datetime,
                    "new_end_datetime": event.end_datetime,
                    "new_location": event.location_en,
                },
            )
        ]

    return []


def _change_for_signup(change: _Change, signup: VolunteerSignup) -> _Change:
    """Attach the recipient details an email needs to a detected change."""
    details = dict(change.details)
    details.setdefault("new_role", signup.slot.position_name)
    details.update(
        {
            "volunteer_signup_id": signup.volunteer_signup_id,
            "first_name": signup.first_name,
            "email": signup.email,
            "slot_id": signup.slot_id,
            "event_id": signup.slot.event_id,
            "event_name": signup.slot.event.title_en,
        }
    )
    return _Change(kind=change.kind, details=details)


def _signups_for_slot(slot: VolunteerSlot) -> list:
    """Return the signups that should hear about a change to ``slot``."""
    if slot.pk is None:
        return []
    return list(slot.signup.select_related("slot__event").all())


def _record(signup_id: int, event_id: int, change: _Change) -> None:
    """Buffer one change and make sure the buffer will be flushed.

    ``on_commit`` is registered on every record rather than guarded by a flag: a
    rollback discards the callback, so a flag would leave the thread convinced a
    flush was still pending and silently stop all later notifications. Registering
    repeatedly is harmless because the first flush drains the whole buffer.
    """
    entry = _buffer().setdefault((signup_id, event_id), {})
    # One entry per (volunteer, event), and the newest value for a kind wins, so
    # the email always describes the final state rather than a stream of edits.
    entry[change.kind] = change.details
    transaction.on_commit(_flush)


def _flush() -> None:
    """Deliver the buffered changes that are still true in the database.

    Entries are dropped when the recorded outcome no longer matches what is
    stored, which is how an edit that was rolled back never reaches a volunteer.
    Each surviving entry goes out as one email per (volunteer, event).

    Delivery is fire-and-forget: a provider outage is logged and swallowed, so a
    broken email can never break or roll back the event edit that caused it.
    """
    pending = take_pending_changes()
    for details_by_kind in pending.values():
        if not _is_still_current(details_by_kind):
            continue
        try:
            _send(details_by_kind)
        except Exception:
            # Broad on purpose, matching the mailing-list sync: a provider
            # outage or a misconfigured EMAIL_PROVIDER must not surface here.
            # No recipient address in the log.
            logger.error("Volunteer change notification failed.")


def _send(details_by_kind: dict) -> None:
    """Send the one email that covers this (volunteer, event) entry.

    A disconnected email service is the only reason this import is local: the
    detection half of this module has to stay usable without it.
    """
    from emails.messages import (  # noqa: PLC0415
        send_volunteer_role_changed_email,
        send_volunteer_shift_moved_email,
        send_volunteer_shift_removed_email,
    )

    email = next(iter(details_by_kind.values()))["email"]

    if REMOVED in details_by_kind:
        # Nothing else matters about a shift that no longer exists, so a removal
        # is the whole message.
        send_volunteer_shift_removed_email(email, details_by_kind[REMOVED])
        return

    if MOVED in details_by_kind:
        # One email that lists every surviving change: a volunteer who both moved
        # and changed role must see both, so the role change is folded into the
        # move rather than dropped by a precedence rule.
        moved = details_by_kind[MOVED]
        role_changed = details_by_kind.get(ROLE_CHANGED)
        send_volunteer_shift_moved_email(
            email,
            {**moved, **(role_changed or {})},
            role_changed_from=(role_changed or {}).get("old_role"),
        )
        return

    if ROLE_CHANGED in details_by_kind:
        send_volunteer_role_changed_email(email, details_by_kind[ROLE_CHANGED])


def _is_still_current(details_by_kind: dict) -> bool:
    """Check one (volunteer, event) entry against the current database state."""
    sample = next(iter(details_by_kind.values()))

    if REMOVED in details_by_kind:
        # A removal is confirmed by the slot being gone. Confirming it the other
        # way round would be wrong: the row is expected to be missing, so a
        # missing row must not count as "no longer true".
        return not VolunteerSlot.objects.filter(
            pk=sample.get("slot_id"),
        ).exists()

    slot = (
        VolunteerSlot.objects.filter(pk=sample.get("slot_id"))
        .select_related("event")
        .first()
    )
    if slot is None:
        return False

    signup = VolunteerSignup.objects.filter(pk=sample["volunteer_signup_id"]).first()
    if signup is None:
        return False
    if signup.slot_id != slot.pk:
        return False

    return _values_match(details_by_kind, slot)


def _values_match(details_by_kind: dict, slot: VolunteerSlot) -> bool:
    """Compare the buffered final values with the rows as they are now."""
    for kind, details in details_by_kind.items():
        if kind == MOVED:
            if slot.start_datetime != details["new_start_datetime"]:
                return False
            if slot.end_datetime != details["new_end_datetime"]:
                return False
            if details.get("new_location") != slot.event.location_en:
                return False
        elif kind == ROLE_CHANGED and slot.position_name != details["new_role"]:
            return False

    return True


def capture_slot_removal(slot: VolunteerSlot) -> tuple:
    """Read everything a removal email needs, before the rows are gone.

    Plain values only: ``VolunteerSlot`` and its signups cascade away together, so
    by the time ``post_delete`` runs the instances still exist in memory but the
    related rows cannot be queried.
    """
    event = {"event_id": slot.event_id, "title_en": slot.event.title_en}
    signups = [
        {
            "volunteer_signup_id": signup.volunteer_signup_id,
            "first_name": signup.first_name,
            "email": signup.email,
            "slot_id": signup.slot_id,
            "position_name": slot.position_name,
            "start_datetime": slot.start_datetime,
            "end_datetime": slot.end_datetime,
        }
        for signup in slot.signup.all()
    ]
    return signups, event


def signup_snapshot(signup: VolunteerSignup) -> dict:
    """Return the stored slot and its schedule, so a reassignment can be judged.

    A signup that points somewhere new is only worth an email when the shift
    itself moved.
    """
    stored = (
        VolunteerSignup.objects.filter(pk=signup.pk)
        .select_related("slot")
        .first()
    )
    if stored is None or stored.slot_id is None:
        return {"slot_id": stored.slot_id if stored else None, "slot": None}

    slot = stored.slot
    return {
        "slot_id": slot.pk,
        "slot": {
            "start_datetime": slot.start_datetime,
            "end_datetime": slot.end_datetime,
        },
    }
