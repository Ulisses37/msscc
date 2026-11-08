from django.db import models

STORAGE_CAPACITY_BYTES = 10 * 1024**3


class DailyVisit(models.Model):
    date = models.DateField(unique=True)
    count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["date"]

    def __str__(self):
        return f"{self.date}: {self.count}"


class StorageUsageSnapshot(models.Model):
    """Singleton snapshot of the configured object-storage bucket."""

    SYNC_OK = "ok"
    SYNC_STALE = "stale"
    SYNC_STATE_CHOICES = (
        (SYNC_OK, "OK"),
        (SYNC_STALE, "Stale"),
    )

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    used_bytes = models.PositiveBigIntegerField(default=0)
    object_count = models.PositiveIntegerField(default=0)
    reserved_bytes = models.PositiveBigIntegerField(default=0)
    capacity_bytes = models.PositiveBigIntegerField(default=STORAGE_CAPACITY_BYTES)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    sync_state = models.CharField(
        max_length=16,
        choices=SYNC_STATE_CHOICES,
        default=SYNC_STALE,
    )
    sync_error = models.TextField(blank=True, default="")

    class Meta:
        db_table = "storage_usage_snapshot"

    def __str__(self):
        return f"Storage usage: {self.used_bytes} bytes"
