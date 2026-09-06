from django.db import models


class Event(models.Model):
    """Event record for activities shown on the site."""

    event_id = models.AutoField(primary_key=True)
    title_en = models.TextField()
    title_ja = models.TextField(blank=True)
    description_en = models.TextField(blank=True)
    description_ja = models.TextField(blank=True)
    location_en = models.TextField()
    location_ja = models.TextField(blank=True)
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()
    volunteer_slots = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    media_asset = models.ForeignKey(
        "media.MediaAsset",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
    )
    calendar_link = models.URLField(blank=True, null=True)

    class Meta:
        ordering = ["start_datetime", "event_id"]
        verbose_name = "Event"
        verbose_name_plural = "Events"
        db_table = "event"

    def __str__(self):
        """Return the event title."""
        return self.title
