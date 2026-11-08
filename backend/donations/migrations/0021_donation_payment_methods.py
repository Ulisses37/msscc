from django.db import migrations, models


class Migration(migrations.Migration):
    """Permit recording already-received card and bank-transfer gifts."""

    dependencies = [("donations", "0020_donationimportbatch_and_more")]

    operations = [
        migrations.AlterField(
            model_name="donation", name="payment_method",
            field=models.CharField(
                blank=True,
                choices=[
                    ("cash", "Cash"), ("check", "Check"),
                    ("card", "Card"), ("bank_transfer", "Bank transfer"),
                ], max_length=20, null=True,
            ),
        ),
        migrations.RemoveConstraint(
            model_name="donation", name="donation_valid_payment_method",
        ),
        migrations.AddConstraint(
            model_name="donation",
            constraint=models.CheckConstraint(
                condition=models.Q(payment_method__isnull=True) | models.Q(
                    payment_method__in=["cash", "check", "card", "bank_transfer"],
                ), name="donation_valid_payment_method",
            ),
        ),
    ]