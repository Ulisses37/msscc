from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("donations", "0016_donation_donor_address_encrypted"),
    ]

    operations = [
        migrations.AddField(
            model_name="membership",
            name="payment_method",
            field=models.CharField(
                blank=True,
                choices=[
                    ("cash", "Cash"),
                    ("check", "Check"),
                    ("card", "Card"),
                    ("bank_transfer", "Bank transfer"),
                    ("other", "Other"),
                ],
                max_length=20,
                null=True,
            ),
        ),
    ]