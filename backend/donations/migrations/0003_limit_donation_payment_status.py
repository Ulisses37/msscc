from django.db import migrations, models


VALID_PAYMENT_STATUSES = (
    "pending",
    "completed",
    "failed",
    "canceled",
)


def normalize_payment_statuses(apps, schema_editor):
    """Replace unsupported development values before adding the constraint."""
    Donation = apps.get_model("donations", "Donation")
    Donation.objects.exclude(payment_status__in=VALID_PAYMENT_STATUSES).update(
        payment_status="canceled"
    )


class Migration(migrations.Migration):

    dependencies = [
        ("donations", "0002_alter_donation_options_alter_membership_options"),
    ]

    operations = [
        migrations.RunPython(
            normalize_payment_statuses,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="donation",
            name="payment_status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("completed", "Completed"),
                    ("failed", "Failed"),
                    ("canceled", "Canceled"),
                ],
                default="pending",
                max_length=10,
            ),
        ),
        migrations.AddConstraint(
            model_name="donation",
            constraint=models.CheckConstraint(
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
        ),
    ]
