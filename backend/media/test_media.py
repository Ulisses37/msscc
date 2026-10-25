from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from media.classification import classify_media
from media.models import MediaAsset

TEST_STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.InMemoryStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}


class MediaClassificationTests(TestCase):
    def test_classifies_supported_signatures(self) -> None:
        cases = (
            ("photo.jpg", "image/jpeg", b"\xff\xd8\xff\xe0", "jpeg", "image"),
            ("photo.jpeg", "image/jpeg", b"\xff\xd8\xff\xe0", "jpeg", "image"),
            ("photo.PNG", "image/png", b"\x89PNG\r\n\x1a\n", "png", "image"),
            ("photo.webp", "image/webp", b"RIFF0000WEBP", "webp", "image"),
            ("document.pdf", "application/pdf", b"%PDF-1.7", "pdf", "pdf"),
        )

        for file_name, mime_type, contents, format_name, kind in cases:
            with self.subTest(file_name=file_name):
                upload = SimpleUploadedFile(file_name, contents, content_type=mime_type)

                result = classify_media(upload)

                self.assertTrue(result.is_valid)
                self.assertEqual(result.detected_format, format_name)
                self.assertEqual(result.detected_kind, kind)
                self.assertEqual(result.detected_mime_type, mime_type)
                self.assertEqual(result.reasons, ())

    def test_classification_restores_stream_position(self) -> None:
        upload = BytesIO(b"prefix\x89PNG\r\n\x1a\n")
        upload.name = "photo.png"
        upload.content_type = "image/png"
        upload.seek(2)

        classify_media(upload)

        self.assertEqual(upload.tell(), 2)

    def test_rejects_unknown_signature(self) -> None:
        upload = SimpleUploadedFile("photo.jpg", b"not an image", content_type="image/jpeg")

        result = classify_media(upload)

        self.assertFalse(result.is_valid)
        self.assertEqual(result.reasons, ("unrecognized_file_signature",))

    def test_rejects_missing_extension_or_mime_type(self) -> None:
        upload = SimpleUploadedFile("photo", b"\x89PNG\r\n\x1a\n")
        upload.content_type = ""

        result = classify_media(upload)

        self.assertFalse(result.is_valid)
        self.assertEqual(
            result.reasons,
            ("missing_file_extension", "missing_mime_type"),
        )

    def test_rejects_metadata_mismatches(self) -> None:
        cases = (
            ("photo.gif", "image/png", "file_extension_mismatch"),
            ("photo.png", "image/jpeg", "mime_type_mismatch"),
        )

        for file_name, mime_type, reason in cases:
            with self.subTest(file_name=file_name):
                upload = SimpleUploadedFile(
                    file_name,
                    b"\x89PNG\r\n\x1a\n",
                    content_type=mime_type,
                )

                result = classify_media(upload)

                self.assertFalse(result.is_valid)
                self.assertIn(reason, result.reasons)


@override_settings(STORAGES=TEST_STORAGES)
class MediaUploadApiTests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()

    def test_upload_stores_detected_mime_type(self) -> None:
        upload = SimpleUploadedFile(
            "photo.PNG",
            b"\x89PNG\r\n\x1a\n",
            content_type="image/png",
        )

        response = self.client.post("/api/media/upload/", {"image": upload}, format="multipart")

        self.assertEqual(response.status_code, 201)
        media = MediaAsset.objects.get()
        self.assertEqual(media.file_type, "image/png")
        self.assertEqual(response.data["media_asset_id"], media.pk)

    def test_upload_rejects_invalid_media_without_creating_asset(self) -> None:
        upload = SimpleUploadedFile("photo.jpg", b"not an image", content_type="image/jpeg")

        response = self.client.post("/api/media/upload/", {"image": upload}, format="multipart")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "invalid_media")
        self.assertEqual(MediaAsset.objects.count(), 0)

    def test_upload_rejects_missing_file(self) -> None:
        response = self.client.post("/api/media/upload/", {}, format="multipart")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "No file provided.")
        self.assertEqual(MediaAsset.objects.count(), 0)
