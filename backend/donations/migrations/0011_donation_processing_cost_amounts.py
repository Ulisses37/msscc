from django.db import migrations, models
from django.db.models import F


def backfill_donation_totals(apps, schema_editor):
    """Copy each existing donation's original base amount without recalculation."""
    donation = apps.get_model("donations", "Donation")
    donation.objects.using(schema_editor.connection.alias).update(total_amount=F("amount"))


class Migration(migrations.Migration):
    dependencies = [("donations", "0010_remove_plaintext_pii")]

    operations = [
        migrations.AddField(
            model_name="donation",
            name="contribute_to_processing_costs",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="donation",
            name="processing_cost_contribution",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        # Add nullable first so every legacy total can be populated from its
        # actual base amount before enforcing the non-null payment invariant.
        migrations.AddField(
            model_name="donation",
            name="total_amount",
            field=models.DecimalField(decimal_places=2, max_digits=10, null=True),
        ),
        migrations.RunPython(backfill_donation_totals, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="donation",
            name="total_amount",
            field=models.DecimalField(decimal_places=2, max_digits=10),
        ),
    ]
