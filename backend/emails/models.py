from django.db import models
from django.utils import timezone


class Subscriber(models.Model):
    """Mailing-list consent record for a single email address.

    This table is the source of truth for whether MSSCC may email someone. The
    email provider is only a mirror of it, which is why ``provider_synced``
    records whether the provider has caught up yet.
    """

    class Status(models.TextChoices):
        """Whether the address currently consents to receive announcements."""

        SUBSCRIBED = "subscribed", "Subscribed"
        UNSUBSCRIBED = "unsubscribed", "Unsubscribed"

    class Source(models.TextChoices):
        """Which entry point collected the signup."""

        FOOTER = "footer", "Footer"
        DONATION = "donation", "Donation"
        MEMBERSHIP = "membership", "Membership"
        VOLUNTEER = "volunteer", "Volunteer"

    # Stored lowercased by the caller; unique so the database enforces one row
    # per address even if application-level normalization is ever bypassed.
    email = models.EmailField(unique=True)
    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.SUBSCRIBED,
    )
    source = models.CharField(max_length=32, choices=Source.choices)
    subscribed_at = models.DateTimeField(default=timezone.now)
    unsubscribed_at = models.DateTimeField(null=True, blank=True)
    # False means the provider mirror is behind and the address should be
    # re-pushed on a later attempt.
    provider_synced = models.BooleanField(default=False)

    class Meta:
        ordering = ["-subscribed_at", "email"]
        verbose_name = "Subscriber"
        verbose_name_plural = "Subscribers"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=["subscribed", "unsubscribed"]),
                name="subscriber_valid_status",
            )
        ]

    def __str__(self):
        """Return the address and current consent state for admin screens."""
        return f"{self.email} ({self.status})"
