from unittest.mock import Mock, patch

from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import AdminUser
from media.storage_usage import (
    BucketUsage,
    reconcile_storage_usage,
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


class StorageUsageCommandTests(TestCase):
    @patch("media.storage_usage.list_bucket_usage", return_value=BucketUsage(123, 4))
    def test_command_repairs_snapshot(self, list_bucket_usage) -> None:
        call_command("sync_storage_usage")

        snapshot = StorageUsageSnapshot.objects.get(pk=1)
        self.assertEqual(snapshot.used_bytes, 123)
        self.assertEqual(snapshot.object_count, 4)


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
