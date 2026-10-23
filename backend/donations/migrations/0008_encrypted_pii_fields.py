from django.db import migrations

from config.fields import EncryptedTextField


class Migration(migrations.Migration):
    """Add nullable encrypted destinations without changing legacy PII."""

    dependencies = [
        ("donations", "0007_payment_receipt_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="donation",
            name="donor_email_encrypted",
            field=EncryptedTextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="donation",
            name="donor_first_name_encrypted",
            field=EncryptedTextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="donation",
            name="donor_last_name_encrypted",
            field=EncryptedTextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="membership",
            name="email_encrypted",
            field=EncryptedTextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="membership",
            name="first_name_encrypted",
            field=EncryptedTextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="membership",
            name="last_name_encrypted",
            field=EncryptedTextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="membership",
            name="phone_encrypted",
            field=EncryptedTextField(blank=True, null=True),
        ),
    ]
