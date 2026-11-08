from django.db import migrations, models


STORAGE_CAPACITY_BYTES = 10 * 1024**3


def create_storage_snapshot(apps, schema_editor):
    StorageUsageSnapshot = apps.get_model("site_analytics", "StorageUsageSnapshot")
    StorageUsageSnapshot.objects.using(schema_editor.connection.alias).get_or_create(
        id=1,
        defaults={"capacity_bytes": STORAGE_CAPACITY_BYTES},
    )


class Migration(migrations.Migration):

    dependencies = [
        ("site_analytics", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="StorageUsageSnapshot",
            fields=[
                (
                    "id",
                    models.PositiveSmallIntegerField(
                        default=1,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("used_bytes", models.PositiveBigIntegerField(default=0)),
                ("object_count", models.PositiveIntegerField(default=0)),
                (
                    "capacity_bytes",
                    models.PositiveBigIntegerField(default=STORAGE_CAPACITY_BYTES),
                ),
                ("last_synced_at", models.DateTimeField(blank=True, null=True)),
                (
                    "sync_state",
                    models.CharField(
                        choices=[("ok", "OK"), ("stale", "Stale")],
                        default="ok",
                        max_length=16,
                    ),
                ),
                ("sync_error", models.TextField(blank=True, default="")),
            ],
            options={"db_table": "storage_usage_snapshot"},
        ),
        migrations.RunPython(create_storage_snapshot, migrations.RunPython.noop),
    ]
