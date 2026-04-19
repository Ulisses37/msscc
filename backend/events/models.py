from django.db import models


class Event(models.Model):
    """Event record for activities shown on the site."""

    event_id = models.AutoField(primary_key=True)
    title = models.TextField()
    description = models.TextField(blank=True)
    location = models.TextField()
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()
    volunteer_slots = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    media_asset_id = models.PositiveIntegerField(blank=True, null=True)

    class Meta:
        ordering = ["start_datetime", "event_id"]
        verbose_name = "Event"
        verbose_name_plural = "Events"
        db_table = "event"

    def __str__(self):
        """Return the event title."""
        return self.title
