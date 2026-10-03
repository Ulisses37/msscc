from django.db import models


EVENT_IMAGE_ALIGNMENT_CHOICES = [
    ("left", "Left"),
    ("center", "Center"),
    ("right", "Right"),
]

EVENT_IMAGE_WIDTH_CHOICES = [
    (25, "25%"),
    (50, "50%"),
    (75, "75%"),
    (100, "100%"),
]


class Event(models.Model):
    """Event record for activities shown on the site."""

    event_id = models.AutoField(primary_key=True)
    title_en = models.TextField()
    title_ja = models.TextField(blank=True)
    description_en = models.TextField(blank=True)
    description_ja = models.TextField(blank=True)
    location_en = models.TextField(blank=True)
    location_ja = models.TextField(blank=True)
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()
    volunteer_slots = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=False)
    send_volunteer_reminders = models.BooleanField(default=False)
    reminder_sent_at = models.DateTimeField(blank=True, null=True)
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


class EventImage(models.Model):
    """Additional image displayed as part of an event's detail content."""

    event_image_id = models.AutoField(primary_key=True)
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="images",
    )
    media_asset = models.ForeignKey(
        "media.MediaAsset",
        on_delete=models.SET_NULL,
        related_name="event_images",
        blank=True,
        null=True,
    )
    caption_en = models.TextField(blank=True)
    caption_ja = models.TextField(blank=True)
    # Lower values render first on the event details page.
    display_order = models.PositiveIntegerField(default=0)
    image_width = models.PositiveSmallIntegerField(
        choices=EVENT_IMAGE_WIDTH_CHOICES,
        default=100,
    )
    image_alignment = models.CharField(
        max_length=6,
        choices=EVENT_IMAGE_ALIGNMENT_CHOICES,
        default="left",
    )

    class Meta:
        ordering = ["event", "display_order", "event_image_id"]
        db_table = "event_image"
        verbose_name = "Event Image"
        verbose_name_plural = "Event Images"

    def __str__(self) -> str:
        """Return the image position and associated event title."""
        return f"Image {self.display_order} for {self.event}"


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
    status = models.CharField(max_length=50, default="approved")
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "volunteer_signup"

    def __str__(self):
        return f"{self.first_name} {self.last_name}"
