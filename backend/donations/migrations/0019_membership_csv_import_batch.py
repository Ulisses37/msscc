import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    """Add nullable membership links and a unique receipt for atomic CSV imports."""

    dependencies = [
        ("donations", "0018_donation_manual_record_fields"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="MembershipImportBatch",
            fields=[
                ("batch_id", models.UUIDField(
                    default=uuid.uuid4, editable=False, primary_key=True, serialize=False,
                )),
                ("fingerprint", models.CharField(max_length=64, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.RemoveConstraint(
            model_name="membership", name="membership_valid_record_source",
        ),
        migrations.AlterField(
            model_name="membership", name="record_source",
            field=models.CharField(
                choices=[
                    ("checkout", "Checkout"), ("manual", "Manually created"),
                    ("legacy_import", "Legacy import"), ("csv_import", "CSV import"),
                ], default="manual", max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="membershipimportbatch", name="created_by",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="membership", name="import_batch",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.PROTECT,
                related_name="memberships", to="donations.membershipimportbatch",
            ),
        ),
        # Expand the existing check rather than removing it: provenance remains
        # constrained in the database, not merely by the admin API.
        migrations.AddConstraint(
            model_name="membership",
            constraint=models.CheckConstraint(
                condition=models.Q(record_source__in=[
                    "checkout", "manual", "legacy_import", "csv_import",
                ]), name="membership_valid_record_source",
            ),
        ),
    ]