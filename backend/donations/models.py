import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from config.fields import EncryptedTextField


class Donation(models.Model):
    """Donation record to store donation information."""

    class RecordSource(models.TextChoices):
        """Known provenance, without classifying legacy records by inference."""

        UNKNOWN = "unknown", "Unknown"
        CHECKOUT = "checkout", "Checkout"
        MANUAL = "manual", "Manual entry"
        CSV_IMPORT = "csv_import", "CSV import"

    class PaymentMethod(models.TextChoices):
        """Explicit offline payment facts, independent of provenance."""

        CASH = "cash", "Cash"
        CHECK = "check", "Check"

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
    donor_address_encrypted = EncryptedTextField(null=True, blank=True)
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
    record_source = models.CharField(
        max_length=20, choices=RecordSource.choices, default=RecordSource.UNKNOWN,
    )
    payment_method = models.CharField(
        max_length=20, choices=PaymentMethod.choices, null=True, blank=True,
    )
    external_reference = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    receipt_sent_at = models.DateTimeField(null=True, blank=True)
    # Historical and manually created donations have no batch; only an
    # authorized CSV confirmation attaches the durable receipt.
    import_batch = models.ForeignKey(
        "DonationImportBatch", null=True, blank=True, on_delete=models.PROTECT,
        related_name="donations",
    )

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
            ),
            models.CheckConstraint(
                condition=models.Q(record_source__in=[
                    "unknown", "checkout", "manual", "csv_import",
                ]),
                name="donation_valid_record_source",
            ),
            models.CheckConstraint(
                condition=models.Q(payment_method__isnull=True)
                | models.Q(payment_method__in=["cash", "check"]),
                name="donation_valid_payment_method",
            ),
        ]

    def __str__(self):
        """Identify the donation without exposing PII in incidental logging."""
        return f"Donation {self.pk} - {self.amount}"

    def save(self, *args, **kwargs):
        """Initialize the total on direct model creation as well as API creation."""
        if self._state.adding and self.total_amount is None:
            self.total_amount = self.amount
        return super().save(*args, **kwargs)


class DonationImportBatch(models.Model):
    """Unique receipt for one committed set of normalized donation facts."""

    batch_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # A unique database key, not a worker-local lock, arbitrates simultaneous
    # confirmations. Its HMAC contains no plaintext contact details.
    fingerprint = models.CharField(max_length=64, unique=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        """Avoid exposing uploaded contacts or fingerprint in incidental logs."""
        return f"Donation import {self.pk}"


class MembershipImportBatch(models.Model):
    """Durable, content-unique receipt for a fully committed CSV import."""

    batch_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # A database constraint, rather than a process-local lock, arbitrates races
    # across workers. The digest contains no plaintext contact details.
    fingerprint = models.CharField(max_length=64, unique=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        """Identify the batch without printing uploaded contacts or its fingerprint."""
        return f"Membership import {self.pk}"


class Membership(models.Model):
    """Membership record to store membership information."""

    class PaymentMethod(models.TextChoices):
        """Explicitly recorded methods, independent of provenance and payment state."""

        CASH = "cash", "Cash"
        CHECK = "check", "Check"
        CARD = "card", "Card"
        BANK_TRANSFER = "bank_transfer", "Bank transfer"
        OTHER = "other", "Other"

    class PaymentStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"
        CANCELED = "canceled", "Canceled"

    class RecordSource(models.TextChoices):
        """Identify the workflow that originally created the membership."""

        CHECKOUT = "checkout", "Checkout"
        MANUAL = "manual", "Manually created"
        LEGACY_IMPORT = "legacy_import", "Legacy import"
        CSV_IMPORT = "csv_import", "CSV import"

    membership_id = models.AutoField(primary_key=True)
    first_name_encrypted = EncryptedTextField(null=True, blank=True)
    last_name_encrypted = EncryptedTextField(null=True, blank=True)
    email_encrypted = EncryptedTextField(null=True, blank=True)
    phone_encrypted = EncryptedTextField(null=True, blank=True)
    address_encrypted = EncryptedTextField(null=True, blank=True)
    membership_type = models.CharField(max_length=255)
    # Unknown historical dues and payments are distinct from a known zero amount.
    membership_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    renewal_date = models.DateField(null=True, blank=True)
    # Manual admin records predate checkout; retain their free-text statuses.
    payment_status = models.CharField(max_length=255, null=True, blank=True)
    payment_method = models.CharField(
        max_length=20, choices=PaymentMethod.choices, null=True, blank=True,
    )
    record_source = models.CharField(
        max_length=20, choices=RecordSource.choices, default=RecordSource.MANUAL,
    )
    # Nullable for every pre-import membership; only CSV imports set this link.
    import_batch = models.ForeignKey(
        MembershipImportBatch, null=True, blank=True, on_delete=models.PROTECT,
        related_name="memberships",
    )
    reference_id = models.CharField(max_length=255)
    # Only checkout-issued references are unique; legacy admin references are editable.
    checkout_reference = models.CharField(max_length=64, unique=True, null=True, blank=True)
    stripe_payment_intent_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    membership_option_id = models.CharField(max_length=32, null=True, blank=True)
    expected_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    contribute_to_processing_costs = models.BooleanField(default=False)
    processing_cost_contribution = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # Only checkout-issued memberships have a base; legacy admin rows remain null.
    base_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, null=True, blank=True)
    status = models.CharField(max_length=255)
    notes = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    receipt_sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-start_date", "-created_at", "membership_id"]
        verbose_name = "Membership"
        verbose_name_plural = "Memberships"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(record_source__in=[
                    "checkout", "manual", "legacy_import", "csv_import",
                ]),
                name="membership_valid_record_source",
            ),
        ]

    def __str__(self):
        """Identify the membership without exposing PII in incidental logging."""
        return f"Membership {self.pk} - {self.membership_type}"


class MembershipAnnualHistory(models.Model):
    """Record an explicit annual membership state independently of payments."""

    membership_annual_history_id = models.AutoField(primary_key=True)
    membership = models.ForeignKey(
        Membership, on_delete=models.CASCADE, related_name="annual_history",
    )
    year = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(9999)],
    )
    # Missing history is unknown; a stored state must be explicitly supplied.
    is_active = models.BooleanField()

    class Meta:
        ordering = ["-year", "membership_annual_history_id"]
        verbose_name = "Membership annual history"
        verbose_name_plural = "Membership annual histories"
        constraints = [
            models.UniqueConstraint(
                fields=["membership", "year"], name="membership_history_unique_year",
            ),
            models.CheckConstraint(
                condition=models.Q(year__gte=1, year__lte=9999),
                name="membership_history_valid_year",
            ),
        ]

    def __str__(self):
        """Identify the annual state without loading encrypted membership fields."""
        state = "active" if self.is_active else "inactive"
        return f"Membership {self.membership_id} - {self.year} - {state}"


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
