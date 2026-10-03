from django.db import models
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from events.models import VolunteerSlot, VolunteerSignup

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
    update_event_volunteer_slots(instance.event)

def update_slot_filled_count(slot):
    """Recalculate and save the filled count for this slot based on its signups."""
    if slot is None:
        return
    total = slot.signup.filter(status='approved').count()
    slot.filled_count = total
    slot.save(update_fields=['filled_count'])


@receiver(post_save, sender=VolunteerSignup)
def signup_saved(sender, instance, **kwargs):
    update_slot_filled_count(instance.slot)


@receiver(post_delete, sender=VolunteerSignup)
def signup_deleted(sender, instance, **kwargs):
    update_slot_filled_count(instance.slot)
