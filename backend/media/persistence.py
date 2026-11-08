"""Persist sanitized media assets and clean up failed storage writes."""

import logging

from django.db import transaction

from .exceptions import MediaPersistenceError
from .models import MediaAsset
from .sanitization import SanitizedMedia
from .storage_usage import (
    StorageQuotaExceededError,
    reserve_storage_bytes,
    schedule_storage_usage_sync,
)

logger = logging.getLogger(__name__)


def persist_media_asset(
    sanitized_media: SanitizedMedia,
    *,
    alt_text_en: str = "",
    alt_text_ja: str = "",
) -> MediaAsset:
    """Save storage and database state, removing storage on database failure."""

    media = MediaAsset(
        file=sanitized_media.file,
        file_name=sanitized_media.file_name,
        file_type=sanitized_media.file_type,
        file_size=sanitized_media.file.size,
        alt_text_en=alt_text_en,
        alt_text_ja=alt_text_ja,
    )

    try:
        #synchronous database save within a transaction to storage
        with transaction.atomic():
            reserve_storage_bytes(sanitized_media.file.size)
            media.save(force_insert=True)

    # If the database save fails, the transaction will be rolled back,
    # and the storage will be cleaned up.
    except StorageQuotaExceededError:
        raise
    except Exception as exc:
        stored_file_name = media.file.name
        if stored_file_name:
            try:
                media.file.storage.delete(stored_file_name)
            except Exception:
                logger.exception(
                    "Failed to remove orphaned media storage object %s",
                    stored_file_name,
                )
        raise MediaPersistenceError("media_persistence_failed") from exc

    schedule_storage_usage_sync()
    return media
