"""Reconcile object-storage usage into the analytics snapshot."""

import logging
from dataclasses import dataclass
from decimal import Decimal

from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone

from site_analytics.models import StorageUsageSnapshot

from .exceptions import MediaPersistenceError

logger = logging.getLogger(__name__)


class StorageUsageSyncError(Exception):
    """Raised when bucket usage cannot be reconciled."""


class StorageQuotaExceededError(MediaPersistenceError):
    """Raised when an upload would exceed the application storage quota."""

    def __init__(
        self,
        *,
        requested_bytes: int,
        used_bytes: int,
        reserved_bytes: int,
        capacity_bytes: int,
        sync_state: str,
        safety_margin_applied: bool,
    ) -> None:
        self.requested_bytes = requested_bytes
        self.used_bytes = used_bytes
        self.reserved_bytes = reserved_bytes
        self.capacity_bytes = capacity_bytes
        self.sync_state = sync_state
        self.safety_margin_applied = safety_margin_applied
        super().__init__("Storage quota exceeded.")

    def as_response_data(self) -> dict[str, object]:
        return {
            "error": "Storage quota exceeded.",
            "code": "storage_quota_exceeded",
            "requested_bytes": self.requested_bytes,
            "used_bytes": self.used_bytes,
            "reserved_bytes": self.reserved_bytes,
            "capacity_bytes": self.capacity_bytes,
            "sync_state": self.sync_state,
            "safety_margin_applied": self.safety_margin_applied,
        }


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


def reserve_storage_bytes(requested_bytes: int) -> None:
    """Reserve upload space while holding the singleton snapshot lock."""

    if requested_bytes < 0:
        raise ValueError("requested_bytes must not be negative")

    with transaction.atomic():
        snapshot = _get_snapshot_for_update()
        is_stale = (
            snapshot.sync_state != StorageUsageSnapshot.SYNC_OK
            or snapshot.last_synced_at is None
        )
        safety_margin_applied = is_stale
        allowed_capacity = snapshot.capacity_bytes
        if safety_margin_applied:
            allowed_capacity = int(
                Decimal(snapshot.capacity_bytes) * Decimal("0.90")
            )

        effective_usage = (
            snapshot.used_bytes + snapshot.reserved_bytes + requested_bytes
        )
        if effective_usage > allowed_capacity:
            raise StorageQuotaExceededError(
                requested_bytes=requested_bytes,
                used_bytes=snapshot.used_bytes,
                reserved_bytes=snapshot.reserved_bytes,
                capacity_bytes=snapshot.capacity_bytes,
                sync_state=snapshot.sync_state,
                safety_margin_applied=safety_margin_applied,
            )

        snapshot.reserved_bytes += requested_bytes
        snapshot.save(update_fields=["reserved_bytes"])


def mark_storage_usage_stale(
    error: Exception | str,
    *,
    release_reserved_bytes: int = 0,
) -> StorageUsageSnapshot:
    """Keep the last values while recording that reconciliation failed."""

    message = str(error)[:2000]
    with transaction.atomic():
        snapshot = _get_snapshot_for_update()
        snapshot.sync_state = StorageUsageSnapshot.SYNC_STALE
        snapshot.sync_error = message
        snapshot.reserved_bytes = max(
            snapshot.reserved_bytes - release_reserved_bytes,
            0,
        )
        snapshot.save(update_fields=["sync_state", "sync_error", "reserved_bytes"])
    return snapshot


def reconcile_storage_usage(
    *,
    raise_on_error: bool = False,
    release_reserved_bytes: int = 0,
) -> StorageUsageSnapshot:
    """Synchronize the singleton snapshot with the current bucket contents."""

    try:
        usage = list_bucket_usage()
        with transaction.atomic():
            snapshot = _get_snapshot_for_update()
            snapshot.used_bytes = usage.used_bytes
            snapshot.object_count = usage.object_count
            snapshot.reserved_bytes = 0
            snapshot.last_synced_at = timezone.now()
            snapshot.sync_state = StorageUsageSnapshot.SYNC_OK
            snapshot.sync_error = ""
            snapshot.save(
                update_fields=[
                    "used_bytes",
                    "object_count",
                    "reserved_bytes",
                    "last_synced_at",
                    "sync_state",
                    "sync_error",
                ]
            )
        return snapshot
    except Exception as exc:
        try:
            mark_storage_usage_stale(
                exc,
                release_reserved_bytes=release_reserved_bytes,
            )
        except Exception:
            logger.exception("Failed to record stale storage usage state")
        if raise_on_error:
            if isinstance(exc, StorageUsageSyncError):
                raise
            raise StorageUsageSyncError("Storage usage reconciliation failed.") from exc
        logger.warning("Storage usage reconciliation failed: %s", exc)
        return StorageUsageSnapshot.objects.get_or_create(id=1)[0]


def schedule_storage_usage_sync(*, reserved_bytes: int = 0) -> None:
    """Reconcile only after the surrounding database transaction commits."""

    transaction.on_commit(
        lambda: reconcile_storage_usage(release_reserved_bytes=reserved_bytes)
    )
