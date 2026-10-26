from django.db import models
from django.db.models.signals import post_delete, post_save, pre_delete, pre_save
from django.dispatch import receiver

from events import services
from events.models import Event, VolunteerSignup, VolunteerSlot


def update_event_volunteer_slots(event):
    """Recalculate and save the total capacity across all slots for this event."""
    total = event.slots.aggregate(total=models.Sum('capacity'))['total'] or 0
    event.volunteer_slots = total
    event.save(update_fields=['volunteer_slots'])


@receiver(post_save, sender=VolunteerSlot)
def slot_saved(sender, instance, **kwargs):
    update_event_volunteer_slots(instance.event)


@receiver(post_delete, sender=VolunteerSlot)
def slot_deleted(sender, instance, **kwargs):
    # The slot row is gone, but its event usually is not (a slot is deleted on
    # its own), so the recount still has somewhere to write. When the whole
    # event was deleted instead, the event is gone too and there is nothing to
    # recount.
    if Event.objects.filter(pk=instance.event_id).exists():
        update_event_volunteer_slots(instance.event)


def update_slot_filled_count(slot):
    """Recalculate and save the filled count for this slot based on its signups."""
    if slot is None:
        return
    total = slot.signup.filter(status='approved').count()
    slot.filled_count = total
    slot.save(update_fields=['filled_count'])


def update_slot_filled_count_for_signup(signup):
    """Recount the slot's filled count, tolerating a slot that no longer exists.

    A signup is deleted either on its own (a volunteer cancelling) or as part of
    deleting its slot, which cascades. In the cascade case ``signup.slot_id``
    still holds the old id but the row is gone, so the recount has nothing to
    write to and is skipped. The check reads the stored id instead of the cached
    foreign key: on a cascade the cache would raise DoesNotExist.
    """
    if signup.slot_id is None:
        return
    if not VolunteerSlot.objects.filter(pk=signup.slot_id).exists():
        return
    update_slot_filled_count(signup.slot)


@receiver(post_save, sender=VolunteerSignup)
def signup_saved(sender, instance, **kwargs):
    update_slot_filled_count_for_signup(instance)


@receiver(post_delete, sender=VolunteerSignup)
def signup_deleted(sender, instance, **kwargs):
    update_slot_filled_count_for_signup(instance)



# ── Volunteer change notification ─────────────────────────────────────────────
# Detection lives here because a saved instance cannot see its own previous
# values. Every tracked model is snapshotted in pre_save and compared in
# post_save. None of this changes what the existing receivers above do.

@receiver(pre_save, sender=VolunteerSlot)
def slot_change_snapshot(sender, instance, update_fields=None, **kwargs):
    instance._change_snapshot = services.snapshot(
        instance,
        services.SLOT_TRACKED_FIELDS,
        update_fields,
    )


@receiver(post_save, sender=VolunteerSlot)
def slot_change_detected(sender, instance, raw=False, **kwargs):
    if raw:
        return
    before = getattr(instance, "_change_snapshot", None)
    if before is not None:
        services.record_slot_changed(instance, before)


@receiver(pre_save, sender=Event)
def event_change_snapshot(sender, instance, update_fields=None, **kwargs):
    if update_fields is not None and not set(update_fields).intersection(
        services.EVENT_TRACKED_FIELDS
    ):
        # Bookkeeping saves (the volunteer_slots recount) are not edits to the
        # event itself, so they must not be compared or notified on.
        instance._change_snapshot = None
        return
    instance._change_snapshot = services.snapshot(
        instance,
        services.EVENT_TRACKED_FIELDS,
        update_fields,
    )


@receiver(post_save, sender=Event)
def event_change_detected(sender, instance, raw=False, **kwargs):
    if raw:
        return
    before = getattr(instance, "_change_snapshot", None)
    if before is not None:
        services.record_event_changed(instance, before)


@receiver(pre_save, sender=VolunteerSignup)
def signup_change_snapshot(sender, instance, **kwargs):
    if instance.pk is None:
        instance._change_snapshot = None
        return
    instance._change_snapshot = services.signup_snapshot(instance)


@receiver(post_save, sender=VolunteerSignup)
def signup_change_detected(sender, instance, raw=False, **kwargs):
    if raw:
        return
    before = getattr(instance, "_change_snapshot", None)
    if before is not None:
        services.record_signup_reassigned(instance, before)


@receiver(pre_delete, sender=VolunteerSlot)
def slot_removal_snapshot(sender, instance, **kwargs):
    # Captured here, not in post_delete: the delete cascades through the signup
    # rows, so by then only plain values still describe who was affected.
    instance._removal_snapshot = services.capture_slot_removal(instance)


@receiver(post_delete, sender=VolunteerSlot)
def slot_removal_detected(sender, instance, **kwargs):
    snapshot = getattr(instance, "_removal_snapshot", None)
    if snapshot is None:
        return
    signups, event = snapshot
    services.record_slot_removed(signups, event)

