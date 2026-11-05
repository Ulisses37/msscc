from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("donations", "0017_membership_payment_method"),
    ]

    operations = [
        migrations.AddField(
            model_name="donation",
            name="record_source",
            field=models.CharField(
                choices=[("unknown", "Unknown"), ("checkout", "Checkout"), ("manual", "Manual entry")],
                default="unknown", max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="donation",
            name="payment_method",
            field=models.CharField(
                choices=[("cash", "Cash"), ("check", "Check")],
                max_length=20, null=True, blank=True,
            ),
        ),
        migrations.AddField(
            model_name="donation",
            name="external_reference",
            field=models.CharField(max_length=255, blank=True, default=""),
        ),
        migrations.AddConstraint(
            model_name="donation",
            constraint=models.CheckConstraint(
                condition=models.Q(record_source__in=["unknown", "checkout", "manual"]),
                name="donation_valid_record_source",
            ),
        ),
        migrations.AddConstraint(
            model_name="donation",
            constraint=models.CheckConstraint(
                condition=models.Q(payment_method__isnull=True)
                | models.Q(payment_method__in=["cash", "check"]),
                name="donation_valid_payment_method",
            ),
        ),
    ]
