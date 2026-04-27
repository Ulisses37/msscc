from django.db import models
from events.models import Event # Linking to existing implemented event

class VolunteerSlot(models.Model):
    volunteer_slot_id = models.AutoField(primary_key=True)
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='slots')
    position_name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()
    capacity = models.IntegerField(default=1)
    filled_count = models.IntegerField(default=0)
    class Meta:
        db_table = 'volunteer_slots'