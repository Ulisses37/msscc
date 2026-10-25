from django.db import migrations, models

from config.fields import EncryptedTextField


def backfill_record_source(apps, schema_editor):
    """Classify existing rows without saving or decrypting their business fields."""
    membership = apps.get_model("donations", "Membership")
    records = membership.objects.using(schema_editor.connection.alias)
    # No legacy imports exist before this migration. Either dedicated checkout
    # identifier is evidence of checkout origin, including incomplete linkage.
    checkout_link = (
        models.Q(checkout_reference__isnull=False) & ~models.Q(checkout_reference="")
    ) | (
        models.Q(stripe_payment_intent_id__isnull=False)
        & ~models.Q(stripe_payment_intent_id="")
    )
    records.filter(checkout_link).update(record_source="checkout")


class Migration(migrations.Migration):
    """Represent unknown historical facts without manufacturing payment or date data."""

    dependencies = [("donations", "0012_membership_processing_cost_amounts")]

    operations = [
        migrations.AddField(
            model_name="membership",
            name="address_encrypted",
            field=EncryptedTextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="membership",
            name="membership_price",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name="membership",
            name="record_source",
            field=models.CharField(
                choices=[
                    ("checkout", "Checkout"),
                    ("manual", "Manually created"),
                    ("legacy_import", "Legacy import"),
                ],
                default="manual",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="membership",
            name="amount_paid",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.AlterField(
            model_name="membership",
            name="end_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="membership",
            name="payment_status",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AlterField(
            model_name="membership",
            name="renewal_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="membership",
            name="start_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.RunPython(backfill_record_source, reverse_code=migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="membership",
            constraint=models.CheckConstraint(
                condition=models.Q(record_source__in=["checkout", "manual", "legacy_import"]),
                name="membership_valid_record_source",
            ),
        ),
    ]
