import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    """Keep legacy donations nullable while permitting only batch-owned CSV provenance."""

    dependencies = [
        ("donations", "0019_membership_csv_import_batch"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='DonationImportBatch',
            fields=[
                ("batch_id", models.UUIDField(
                    default=uuid.uuid4, editable=False, primary_key=True, serialize=False,
                )),
                ("fingerprint", models.CharField(max_length=64, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.RemoveConstraint(
            model_name="donation", name="donation_valid_record_source",
        ),
        migrations.AlterField(
            model_name="donation", name="record_source",
            field=models.CharField(
                choices=[
                    ("unknown", "Unknown"), ("checkout", "Checkout"),
                    ("manual", "Manual entry"), ("csv_import", "CSV import"),
                ], default="unknown", max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="donationimportbatch", name="created_by",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="donation", name="import_batch",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.PROTECT,
                related_name="donations", to="donations.donationimportbatch",
            ),
        ),
        # Expand rather than remove the provenance check: the database still
        # rejects unrecognized origins, including forged checkout values.
        migrations.AddConstraint(
            model_name="donation",
            constraint=models.CheckConstraint(
                condition=models.Q(record_source__in=[
                    "unknown", "checkout", "manual", "csv_import",
                ]), name="donation_valid_record_source",
            ),
        ),
    ]
