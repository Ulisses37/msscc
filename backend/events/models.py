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
        return self.title_en


class VolunteerSlot(models.Model):
    volunteer_slot_id = models.AutoField(primary_key=True)
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="slots")
    position_name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()
    capacity = models.IntegerField(default=1)
    filled_count = models.IntegerField(default=0)

    class Meta:
        db_table = "volunteer_slots"

    def __str__(self):
        return f"{self.position_name} - {self.event}"


class VolunteerSignup(models.Model):
    volunteer_signup_id = models.AutoField(primary_key=True)
    slot = models.ForeignKey(
        VolunteerSlot,
        on_delete=models.CASCADE,
        related_name="signup",
        null=True,
        blank=True,
    )
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    status = models.CharField(max_length=50, default="pending")
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "volunteer_signup"

    def __str__(self):
        return f"{self.first_name} {self.last_name}"
