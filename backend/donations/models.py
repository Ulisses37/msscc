from django.db import models
from django.utils import timezone


class Donation(models.Model):
    """Donation record to store donation information."""

    class PaymentStatus(models.TextChoices):
        """Payment states that may be stored for a donation."""

        PENDING = "pending", "Pending"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"
        CANCELED = "canceled", "Canceled"

    donation_id = models.AutoField(primary_key=True)
    donor_first_name = models.CharField(max_length=255)
    donor_last_name = models.CharField(max_length=255)
    donor_email = models.EmailField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
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
        """Return a readable donor summary for admin screens."""
        return f"{self.donor_first_name} {self.donor_last_name} - {self.amount}"


class Membership(models.Model):
    """Membership record to store membership information."""

    class PaymentStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"
        CANCELED = "canceled", "Canceled"

    membership_id = models.AutoField(primary_key=True)
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=255)
    membership_type = models.CharField(max_length=255)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2)
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
        """Return a readable member summary for admin screens."""
        return f"{self.first_name} {self.last_name} - {self.membership_type}"


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
