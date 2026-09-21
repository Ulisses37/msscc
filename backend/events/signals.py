from django.db import models
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from events.models import VolunteerSlot

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
