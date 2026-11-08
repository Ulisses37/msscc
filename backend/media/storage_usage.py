"""Reconcile object-storage usage into the analytics snapshot."""

import logging
from dataclasses import dataclass

from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone

from site_analytics.models import StorageUsageSnapshot

logger = logging.getLogger(__name__)


class StorageUsageSyncError(Exception):
    """Raised when bucket usage cannot be reconciled."""


@dataclass(frozen=True)
class BucketUsage:
    used_bytes: int
    object_count: int


def list_bucket_usage() -> BucketUsage:
    """Return totals for every current object in the configured bucket."""

    storage = default_storage
    try:
        bucket = storage.bucket
        client = bucket.meta.client
        paginator = client.get_paginator("list_objects_v2")
    except Exception as exc:
        raise StorageUsageSyncError("Object storage does not support bucket listing.") from exc

    used_bytes = 0
    object_count = 0
    try:
        pages = paginator.paginate(Bucket=bucket.name)
        for page in pages:
            for item in page.get("Contents", ()):
                used_bytes += int(item.get("Size", 0))
                object_count += 1
    except Exception as exc:
        raise StorageUsageSyncError("Object storage bucket listing failed.") from exc

    return BucketUsage(used_bytes=used_bytes, object_count=object_count)


def _get_snapshot_for_update() -> StorageUsageSnapshot:
    snapshot, _ = StorageUsageSnapshot.objects.get_or_create(id=1)
    return StorageUsageSnapshot.objects.select_for_update().get(pk=snapshot.pk)


def mark_storage_usage_stale(error: Exception | str) -> StorageUsageSnapshot:
    """Keep the last values while recording that reconciliation failed."""

    message = str(error)[:2000]
    with transaction.atomic():
        snapshot = _get_snapshot_for_update()
        snapshot.sync_state = StorageUsageSnapshot.SYNC_STALE
        snapshot.sync_error = message
        snapshot.save(update_fields=["sync_state", "sync_error"])
    return snapshot


def reconcile_storage_usage(*, raise_on_error: bool = False) -> StorageUsageSnapshot:
    """Synchronize the singleton snapshot with the current bucket contents."""

    try:
        usage = list_bucket_usage()
        with transaction.atomic():
            snapshot = _get_snapshot_for_update()
            snapshot.used_bytes = usage.used_bytes
            snapshot.object_count = usage.object_count
            snapshot.last_synced_at = timezone.now()
            snapshot.sync_state = StorageUsageSnapshot.SYNC_OK
            snapshot.sync_error = ""
            snapshot.save(
                update_fields=[
                    "used_bytes",
                    "object_count",
                    "last_synced_at",
                    "sync_state",
                    "sync_error",
                ]
            )
        return snapshot
    except Exception as exc:
        try:
            mark_storage_usage_stale(exc)
        except Exception:
            logger.exception("Failed to record stale storage usage state")
        if raise_on_error:
            if isinstance(exc, StorageUsageSyncError):
                raise
            raise StorageUsageSyncError("Storage usage reconciliation failed.") from exc
        logger.warning("Storage usage reconciliation failed: %s", exc)
        return StorageUsageSnapshot.objects.get_or_create(id=1)[0]


def schedule_storage_usage_sync() -> None:
    """Reconcile only after the surrounding database transaction commits."""

    transaction.on_commit(reconcile_storage_usage)
