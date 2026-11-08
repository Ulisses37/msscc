from unittest.mock import Mock, patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import AdminUser
from media.storage_usage import (
    BucketUsage,
    StorageQuotaExceededError,
    reconcile_storage_usage,
    reserve_storage_bytes,
)
from site_analytics.models import StorageUsageSnapshot


class StorageUsageServiceTests(TestCase):
    def test_reconciliation_sums_paginated_bucket_contents(self) -> None:
        first_page = {"Contents": [{"Size": 100}, {"Size": 250}]}
        second_page = {"Contents": [{"Size": 50}]}
        paginator = Mock()
        paginator.paginate.return_value = [first_page, second_page]
        bucket = Mock(name="bucket-name")
        bucket.name = "bucket-name"
        bucket.meta.client.get_paginator.return_value = paginator

        with patch("media.storage_usage.default_storage") as storage:
            storage.bucket = bucket

            snapshot = reconcile_storage_usage()

        self.assertEqual(snapshot.used_bytes, 400)
        self.assertEqual(snapshot.object_count, 3)
        paginator.paginate.assert_called_once_with(Bucket="bucket-name")

    @patch("media.storage_usage.list_bucket_usage", return_value=BucketUsage(0, 0))
    def test_empty_bucket_resets_snapshot(self, list_bucket_usage) -> None:
        StorageUsageSnapshot.objects.filter(id=1).update(
            used_bytes=400,
            object_count=3,
        )

        snapshot = reconcile_storage_usage()

        self.assertEqual(snapshot.used_bytes, 0)
        self.assertEqual(snapshot.object_count, 0)
        self.assertEqual(snapshot.sync_state, StorageUsageSnapshot.SYNC_OK)

    @patch("media.storage_usage.list_bucket_usage", side_effect=RuntimeError("bucket down"))
    def test_failed_reconciliation_marks_snapshot_stale(self, list_bucket_usage) -> None:
        StorageUsageSnapshot.objects.filter(id=1).update(
            used_bytes=400,
            object_count=3,
        )

        snapshot = reconcile_storage_usage()

        self.assertEqual(snapshot.used_bytes, 400)
        self.assertEqual(snapshot.object_count, 3)
        self.assertEqual(snapshot.sync_state, StorageUsageSnapshot.SYNC_STALE)
        self.assertIn("bucket down", snapshot.sync_error)

    @patch("media.storage_usage.list_bucket_usage", return_value=BucketUsage(10, 1))
    def test_successful_reconciliation_clears_abandoned_reservations(
        self,
        list_bucket_usage,
    ) -> None:
        StorageUsageSnapshot.objects.filter(id=1).update(reserved_bytes=500)

        snapshot = reconcile_storage_usage()

        snapshot.refresh_from_db()
        self.assertEqual(snapshot.reserved_bytes, 0)

    @patch("media.storage_usage.list_bucket_usage", side_effect=RuntimeError("offline"))
    def test_failed_reconciliation_releases_completed_reservation(
        self,
        list_bucket_usage,
    ) -> None:
        StorageUsageSnapshot.objects.filter(id=1).update(reserved_bytes=500)

        snapshot = reconcile_storage_usage(release_reserved_bytes=125)

        self.assertEqual(snapshot.reserved_bytes, 375)
        self.assertEqual(snapshot.sync_state, StorageUsageSnapshot.SYNC_STALE)

    def test_reservations_are_checked_against_fresh_usage(self) -> None:
        StorageUsageSnapshot.objects.filter(id=1).update(
            used_bytes=80,
            reserved_bytes=0,
            capacity_bytes=100,
            sync_state=StorageUsageSnapshot.SYNC_OK,
            last_synced_at=timezone.now(),
        )

        reserve_storage_bytes(20)

        with self.assertRaises(StorageQuotaExceededError):
            reserve_storage_bytes(1)

        self.assertEqual(
            StorageUsageSnapshot.objects.get(pk=1).reserved_bytes,
            20,
        )

    def test_stale_usage_uses_the_ninety_percent_safety_threshold(self) -> None:
        StorageUsageSnapshot.objects.filter(id=1).update(
            used_bytes=80,
            reserved_bytes=0,
            capacity_bytes=100,
            sync_state=StorageUsageSnapshot.SYNC_STALE,
            last_synced_at=None,
        )

        with self.assertRaises(StorageQuotaExceededError) as raised:
            reserve_storage_bytes(21)

        self.assertTrue(raised.exception.safety_margin_applied)


class StorageUsageCommandTests(TestCase):
    @patch("media.storage_usage.list_bucket_usage", return_value=BucketUsage(123, 4))
    def test_command_repairs_snapshot(self, list_bucket_usage) -> None:
        call_command("sync_storage_usage")

        snapshot = StorageUsageSnapshot.objects.get(pk=1)
        self.assertEqual(snapshot.used_bytes, 123)
        self.assertEqual(snapshot.object_count, 4)

    @override_settings(STORAGE_CAPACITY_BYTES=1234)
    def test_quota_command_updates_database_from_environment(self) -> None:
        call_command("sync_storage_quota")

        self.assertEqual(
            StorageUsageSnapshot.objects.get(pk=1).capacity_bytes,
            1234,
        )

    @override_settings(STORAGE_CAPACITY_BYTES=1234)
    def test_quota_command_dry_run_does_not_write(self) -> None:
        StorageUsageSnapshot.objects.filter(pk=1).update(capacity_bytes=5678)

        call_command("sync_storage_quota", "--dry-run")

        self.assertEqual(
            StorageUsageSnapshot.objects.get(pk=1).capacity_bytes,
            5678,
        )

    @override_settings(STORAGE_CAPACITY_BYTES=0)
    def test_quota_command_rejects_non_positive_configuration(self) -> None:
        with self.assertRaises(CommandError):
            call_command("sync_storage_quota")


class StorageUsageApiTests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.admin = AdminUser.objects.create_user(email="admin@example.com")
        self.client.force_authenticate(user=self.admin)

    def test_any_authenticated_admin_can_read_storage_usage(self) -> None:
        StorageUsageSnapshot.objects.filter(id=1).update(
            used_bytes=5 * 1024**3,
            object_count=10,
        )

        response = self.client.get("/api/media/total-size/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["used_bytes"], 5 * 1024**3)
        self.assertEqual(response.data["usage_percentage"], 50)

    def test_capacity_is_not_negative_and_percentage_is_capped(self) -> None:
        StorageUsageSnapshot.objects.filter(id=1).update(
            used_bytes=20,
            capacity_bytes=10,
        )

        response = self.client.get("/api/media/total-size/")

        self.assertEqual(response.data["remaining_bytes"], 0)
        self.assertEqual(response.data["usage_percentage"], 100)

    def test_anonymous_user_is_rejected(self) -> None:
        self.client.force_authenticate(user=None)

        response = self.client.get("/api/media/total-size/")

        self.assertEqual(response.status_code, 401)
