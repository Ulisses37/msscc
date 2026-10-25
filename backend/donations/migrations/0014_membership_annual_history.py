import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """Add annual membership evidence without inferring history or payments."""

    dependencies = [("donations", "0013_membership_legacy_fields")]

    operations = [
        migrations.CreateModel(
            name="MembershipAnnualHistory",
            fields=[
                (
                    "membership_annual_history_id",
                    models.AutoField(primary_key=True, serialize=False),
                ),
                (
                    "year",
                    models.PositiveIntegerField(
                        validators=[
                            django.core.validators.MinValueValidator(1),
                            django.core.validators.MaxValueValidator(9999),
                        ],
                    ),
                ),
                ("is_active", models.BooleanField()),
                (
                    "membership",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="annual_history",
                        to="donations.membership",
                    ),
                ),
            ],
            options={
                "verbose_name": "Membership annual history",
                "verbose_name_plural": "Membership annual histories",
                "ordering": ["-year", "membership_annual_history_id"],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("membership", "year"), name="membership_history_unique_year",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(year__gte=1, year__lte=9999),
                        name="membership_history_valid_year",
                    ),
                ],
            },
        ),
    ]
