from django.db import migrations

from config.fields import EncryptedTextField


class Migration(migrations.Migration):
    """Add optional encrypted storage without inferring historical addresses."""

    dependencies = [
        ("donations", "0015_donation_receipt_sent_at_membership_receipt_sent_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="donation",
            name="donor_address_encrypted",
            field=EncryptedTextField(blank=True, null=True),
        ),
    ]
