import django.utils.timezone
from django.db import migrations, models

INITIAL_TABLE_REVISIONS = (
    "donations",
    "memberships",
)


def create_initial_table_revisions(apps, schema_editor):
    """Create the revision rows used by the donations and memberships admin tables."""
    AdminTableRevision = apps.get_model("donations", "AdminTableRevision")

    for table_name in INITIAL_TABLE_REVISIONS:
        # This remains safe if migration initialization is invoked more than once.
        AdminTableRevision.objects.get_or_create(
            table_name=table_name,
            defaults={"revision": 0},
        )


class Migration(migrations.Migration):

    dependencies = [
        ("donations", "0003_limit_donation_payment_status"),
    ]

    operations = [
        migrations.CreateModel(
            name="AdminTableRevision",
            fields=[
                (
                    "table_name",
                    models.CharField(
                        choices=[
                            ("donations", "Donations"),
                            ("memberships", "Memberships"),
                        ],
                        max_length=32,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("revision", models.BigIntegerField(default=0)),
                ("changed_at", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={
                "db_table": "donations_admin_table_revision",
            },
        ),
        migrations.RunPython(
            create_initial_table_revisions,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
