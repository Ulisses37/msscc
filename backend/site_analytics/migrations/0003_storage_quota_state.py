from django.db import migrations, models


def mark_unsynchronized_snapshots_stale(apps, schema_editor):
    StorageUsageSnapshot = apps.get_model("site_analytics", "StorageUsageSnapshot")
    StorageUsageSnapshot.objects.using(schema_editor.connection.alias).filter(
        last_synced_at__isnull=True,
    ).update(
        sync_state="stale",
        sync_error="Initial storage usage synchronization required.",
    )


class Migration(migrations.Migration):

    dependencies = [
        ("site_analytics", "0002_storageusagesnapshot"),
    ]

    operations = [
        migrations.AddField(
            model_name="storageusagesnapshot",
            name="reserved_bytes",
            field=models.PositiveBigIntegerField(default=0),
        ),
        migrations.AlterField(
            model_name="storageusagesnapshot",
            name="sync_state",
            field=models.CharField(
                choices=[("ok", "OK"), ("stale", "Stale")],
                default="stale",
                max_length=16,
            ),
        ),
        migrations.RunPython(mark_unsynchronized_snapshots_stale, migrations.RunPython.noop),
    ]
