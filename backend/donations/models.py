from django.db import models


class Donation(models.Model):
    """Donation record to store donation information."""

    donation_id = models.AutoField(primary_key=True)
    donor_first_name = models.CharField(max_length=255)
    donor_last_name = models.CharField(max_length=255)
    donor_email = models.EmailField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    donation_date = models.DateField()
    is_anonymous = models.BooleanField()
    message = models.TextField()
    payment_status = models.CharField(max_length=255)
    reference_id = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-donation_date", "-created_at", "donation_id"]
        verbose_name = "Donation"
        verbose_name_plural = "Donations"

    def __str__(self):
        """Return a readable donor summary for admin screens."""
        return f"{self.donor_first_name} {self.donor_last_name} - {self.amount}"


class Membership(models.Model):
    """Membership record to store membership information."""

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
    payment_status = models.CharField(max_length=255)
    reference_id = models.CharField(max_length=255)
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
