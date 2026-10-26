import hashlib
import secrets
from datetime import timedelta

from django.db import models
from django.utils import timezone

# How long a confirmation link stays usable. Well beyond the re-send cooldown
# below, which is what actually paces repeat emails.
CONFIRMATION_TOKEN_TTL = timedelta(hours=48)
# Shortest gap between two confirmation emails for the same address. Bounds both
# a repeated public signup and mailbombing someone else's address; see
# decisions in the story A PR notes.
CONFIRMATION_RESEND_COOLDOWN = timedelta(minutes=15)
# Byte length of the raw URL-safe token. The stored value is its SHA-256 hex
# digest, so this only affects how guessing-resistant the link is.
CONFIRMATION_TOKEN_BYTES = 32


def hash_confirmation_token(raw_token: str) -> str:
    """Return the stored digest for a raw confirmation token.

    One place computes this, so the write in ``issue_confirmation_token`` and
    the lookup in the confirm step can never drift apart.
    """
    return hashlib.sha256(raw_token.encode()).hexdigest()


class Subscriber(models.Model):
    """Mailing-list consent record for a single email address.

    This table is the source of truth for whether MSSCC may email someone. The
    email provider is only a mirror of it, which is why ``provider_synced``
    records whether the provider has caught up yet.

    A new signup only records intent: the row stays ``pending`` until the
    address confirms from its own inbox. The confirmation token is stored as a
    SHA-256 hash, so a database dump cannot be used to confirm someone else's
    address.
    """

    class Status(models.TextChoices):
        """Whether the address currently consents to receive announcements."""

        PENDING = "pending", "Pending"
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
    # False means the provider mirror is behind. Only the confirm step writes
    # this, and a failed mirror write is retried by the next confirmation.
    provider_synced = models.BooleanField(default=False)
    # SHA-256 hex digest of the raw confirmation token. The raw value is only
    # ever in the email we send, never in the database. Indexed rather than
    # unique because every non-pending row shares the blank default.
    confirmation_token_hash = models.CharField(
        max_length=64,
        blank=True,
        default="",
        db_index=True,
    )
    confirmation_sent_at = models.DateTimeField(null=True, blank=True)
    confirmation_expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-subscribed_at", "email"]
        verbose_name = "Subscriber"
        verbose_name_plural = "Subscribers"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=["pending", "subscribed", "unsubscribed"]),
                name="subscriber_valid_status",
            )
        ]

    def __str__(self):
        """Return the address and current consent state for admin screens."""
        return f"{self.email} ({self.status})"

    def issue_confirmation_token(self) -> str:
        """Store a fresh confirmation token and return the raw value.

        The raw value is never persisted, so returning it is the only way the
        caller can put it in the confirmation email. Overwrites any earlier
        token, which is why a link from a previous email stops working.
        """
        raw_token = secrets.token_urlsafe(CONFIRMATION_TOKEN_BYTES)
        now = timezone.now()
        self.confirmation_token_hash = hash_confirmation_token(raw_token)
        self.confirmation_sent_at = now
        self.confirmation_expires_at = now + CONFIRMATION_TOKEN_TTL
        self.save(
            update_fields=[
                "confirmation_token_hash",
                "confirmation_sent_at",
                "confirmation_expires_at",
            ]
        )
        return raw_token

    def clear_confirmation_token(self) -> None:
        """Drop the stored token so the link cannot be used a second time."""
        self.confirmation_token_hash = ""
        self.confirmation_sent_at = None
        self.confirmation_expires_at = None
        self.save(
            update_fields=[
                "confirmation_token_hash",
                "confirmation_sent_at",
                "confirmation_expires_at",
            ]
        )
