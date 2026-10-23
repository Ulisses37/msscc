from django.db import models
from django.utils import timezone

from config.fields import EncryptedTextField


class Donation(models.Model):
    """Donation record to store donation information."""

    class PaymentStatus(models.TextChoices):
        """Payment states that may be stored for a donation."""

        PENDING = "pending", "Pending"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"
        CANCELED = "canceled", "Canceled"

    donation_id = models.AutoField(primary_key=True)
    donor_first_name_encrypted = EncryptedTextField(null=True, blank=True)
    donor_last_name_encrypted = EncryptedTextField(null=True, blank=True)
    donor_email_encrypted = EncryptedTextField(null=True, blank=True)
    # Keep amount as the original/base donation so existing admin and receipt
    # data do not silently change meaning when contribution totals are added.
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    contribute_to_processing_costs = models.BooleanField(default=False)
    processing_cost_contribution = models.DecimalField(
        max_digits=10, decimal_places=2, default=0
    )
    # No constant default can represent an arbitrary donation amount. New
    # records initialize this from amount in save(); the migration backfills
    # historical records from their own original amount instead.
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="usd")
    completed_at = models.DateTimeField(null=True, blank=True)
    donation_date = models.DateField()
    is_anonymous = models.BooleanField()
    message = models.TextField()
    payment_status = models.CharField(
        max_length=10,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )
    reference_id = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-donation_date", "-created_at", "donation_id"]
        verbose_name = "Donation"
        verbose_name_plural = "Donations"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    payment_status__in=[
                        "pending",
                        "completed",
                        "failed",
                        "canceled",
                    ]
                ),
                name="donation_valid_payment_status",
            )
        ]

    def __str__(self):
        """Identify the donation without exposing PII in incidental logging."""
        return f"Donation {self.pk} - {self.amount}"

    def save(self, *args, **kwargs):
        """Initialize the total on direct model creation as well as API creation."""
        if self._state.adding and self.total_amount is None:
            self.total_amount = self.amount
        return super().save(*args, **kwargs)


class Membership(models.Model):
    """Membership record to store membership information."""

    class PaymentStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"
        CANCELED = "canceled", "Canceled"

    membership_id = models.AutoField(primary_key=True)
    first_name_encrypted = EncryptedTextField(null=True, blank=True)
    last_name_encrypted = EncryptedTextField(null=True, blank=True)
    email_encrypted = EncryptedTextField(null=True, blank=True)
    phone_encrypted = EncryptedTextField(null=True, blank=True)
    membership_type = models.CharField(max_length=255)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2)
    completed_at = models.DateTimeField(null=True, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    renewal_date = models.DateField()
    # Manual admin records predate checkout; retain their free-text statuses.
    payment_status = models.CharField(max_length=255, default=PaymentStatus.PENDING)
    reference_id = models.CharField(max_length=255)
    # Only checkout-issued references are unique; legacy admin references are editable.
    checkout_reference = models.CharField(max_length=64, unique=True, null=True, blank=True)
    stripe_payment_intent_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    membership_option_id = models.CharField(max_length=32, null=True, blank=True)
    expected_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, null=True, blank=True)
    status = models.CharField(max_length=255)
    notes = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date", "-created_at", "membership_id"]
        verbose_name = "Membership"
        verbose_name_plural = "Memberships"

    def __str__(self):
        """Identify the membership without exposing PII in incidental logging."""
        return f"Membership {self.pk} - {self.membership_type}"


class AdminTableRevision(models.Model):
    """Track revisions for admin tables that support automatic refreshes."""

    class TableName(models.TextChoices):
        """Table names supported by the admin refresh system."""

        DONATIONS = "donations", "Donations"
        MEMBERSHIPS = "memberships", "Memberships"

    table_name = models.CharField(
        max_length=32,
        primary_key=True,
        choices=TableName.choices,
    )
    revision = models.BigIntegerField(default=0)
    changed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "donations_admin_table_revision"

    def __str__(self):
        """Return the tracked table name."""
        return self.table_name
