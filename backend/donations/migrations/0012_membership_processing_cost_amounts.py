from django.db import migrations, models


class Migration(migrations.Migration):
    """Add only non-PII checkout amounts after encrypted identity migration 0010.

    Existing admin memberships have no trusted checkout base; leave it null
    rather than inventing a price or rewriting encrypted identity columns.
    """

    dependencies = [("donations", "0011_donation_processing_cost_amounts")]

    operations = [
        migrations.AddField(
            model_name="membership",
            name="contribute_to_processing_costs",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="membership",
            name="processing_cost_contribution",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name="membership",
            name="base_amount",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
    ]
