# backend/media/tests.py
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import MediaAsset

# Avoid writing to MinIO during tests (Django 4.2+)
TEST_STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}


def make_asset(name, size):
    return MediaAsset.objects.create(
        file_name=name, file=f"public/{name}", file_type="image/png", file_size=size
    )


class TotalSizeViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_empty_table_returns_zero(self):
        res = self.client.get("/api/media/total-size/")  # adjust to your real path
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["total_size_bytes"], 0)

    def test_sums_sizes_and_ignores_nulls(self):
        make_asset("a.png", 100)
        make_asset("b.png", 250)
        make_asset("old.png", None)
        res = self.client.get("/api/media/total-size/")
        self.assertEqual(res.data["total_size_bytes"], 350)
        self.assertEqual(res.data["file_count"], 3)
        self.assertEqual(res.data["files_with_size"], 2)


@override_settings(STORAGES=TEST_STORAGES)
class UploadTests(TestCase):
    def test_upload_records_file_size(self):
        content = b"x" * 1234
        upload = SimpleUploadedFile("pic.png", content, content_type="image/png")
        res = APIClient().post("/api/media/upload/", {"image": upload}, format="multipart")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(MediaAsset.objects.get().file_size, 1234)
