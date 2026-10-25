from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from media.classification import classify_media
from media.models import MediaAsset
from media.sanitization import sanitize_media
from media.validation import validate_media

TEST_STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.InMemoryStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}


def image_bytes(format_name: str = "PNG", size: tuple[int, int] = (1, 1)) -> bytes:
    output = BytesIO()
    Image.new("RGB", size, color=(0, 128, 128)).save(output, format=format_name)
    return output.getvalue()


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


class MediaValidationTests(TestCase):
    def test_validates_real_image_contents(self) -> None:
        upload = SimpleUploadedFile(
            "photo.png",
            image_bytes(),
            content_type="image/png",
        )
        classification = classify_media(upload)

        result = validate_media(upload, classification)

        self.assertTrue(result.is_valid)
        self.assertEqual(result.image_width, 1)
        self.assertEqual(result.image_height, 1)

    def test_rejects_corrupt_image_contents(self) -> None:
        upload = SimpleUploadedFile(
            "photo.png",
            b"\x89PNG\r\n\x1a\nnot a complete png",
            content_type="image/png",
        )
        classification = classify_media(upload)

        result = validate_media(upload, classification)

        self.assertFalse(result.is_valid)
        self.assertEqual(result.reasons, ("image_content_invalid",))

    @override_settings(MEDIA_MAX_IMAGE_PIXELS=1)
    def test_rejects_images_over_pixel_limit(self) -> None:
        upload = SimpleUploadedFile(
            "photo.png",
            image_bytes(size=(2, 1)),
            content_type="image/png",
        )
        classification = classify_media(upload)

        result = validate_media(upload, classification)

        self.assertFalse(result.is_valid)
        self.assertEqual(result.reasons, ("image_dimensions_too_large",))

    @override_settings(MEDIA_MAX_UPLOAD_SIZE_BYTES=10)
    def test_rejects_files_over_size_limit(self) -> None:
        upload = SimpleUploadedFile(
            "photo.png",
            image_bytes(),
            content_type="image/png",
        )
        classification = classify_media(upload)

        result = validate_media(upload, classification)

        self.assertFalse(result.is_valid)
        self.assertEqual(result.reasons, ("file_too_large",))

    def test_validates_pdf_eof_marker(self) -> None:
        upload = SimpleUploadedFile(
            "document.pdf",
            b"%PDF-1.7\nminimal document\n%%EOF\n",
            content_type="application/pdf",
        )
        classification = classify_media(upload)

        result = validate_media(upload, classification)

        self.assertTrue(result.is_valid)

    def test_rejects_pdf_without_eof_marker(self) -> None:
        upload = SimpleUploadedFile(
            "document.pdf",
            b"%PDF-1.7\nmissing eof marker\n",
            content_type="application/pdf",
        )
        classification = classify_media(upload)

        result = validate_media(upload, classification)

        self.assertFalse(result.is_valid)
        self.assertEqual(result.reasons, ("pdf_content_invalid",))


class MediaSanitizationTests(TestCase):
    def test_preserves_image_extensions_and_formats(self) -> None:
        cases = (
            ("photo.jpg", "image/jpeg", "JPEG", "image/jpeg"),
            ("photo.jpeg", "image/jpeg", "JPEG", "image/jpeg"),
            ("photo.png", "image/png", "PNG", "image/png"),
            ("photo.webp", "image/webp", "WEBP", "image/webp"),
        )

        for file_name, mime_type, image_format, output_mime_type in cases:
            with self.subTest(file_name=file_name):
                format_name = image_format
                upload = SimpleUploadedFile(
                    file_name,
                    image_bytes(format_name),
                    content_type=mime_type,
                )
                classification = classify_media(upload)

                result = sanitize_media(upload, classification)

                self.assertTrue(result.converted)
                self.assertTrue(result.file_name.endswith(file_name.rsplit(".", 1)[1]))
                self.assertEqual(result.file_type, output_mime_type)
                with Image.open(result.file) as image:
                    self.assertEqual(image.format, image_format)
                    self.assertEqual(image.size, (1, 1))

    def test_strips_image_metadata(self) -> None:
        source = Image.new("RGB", (1, 1), color=(0, 128, 128))
        exif = Image.Exif()
        exif[270] = "private metadata"
        source_bytes = BytesIO()
        source.save(source_bytes, format="JPEG", exif=exif)
        upload = SimpleUploadedFile(
            "photo.jpg",
            source_bytes.getvalue(),
            content_type="image/jpeg",
        )
        classification = classify_media(upload)

        result = sanitize_media(upload, classification)

        with Image.open(result.file) as image:
            self.assertEqual(len(image.getexif()), 0)

    @override_settings(MEDIA_MAX_IMAGE_DIMENSION=4)
    def test_resizes_images_without_upscaling(self) -> None:
        upload = SimpleUploadedFile(
            "large.png",
            image_bytes(size=(8, 4)),
            content_type="image/png",
        )
        classification = classify_media(upload)

        result = sanitize_media(upload, classification)

        with Image.open(result.file) as image:
            self.assertEqual(image.size, (4, 2))

    def test_normalizes_pdf_name_without_converting_contents(self) -> None:
        upload = SimpleUploadedFile(
            "document.PDF",
            b"%PDF-1.7\nminimal document\n%%EOF\n",
            content_type="application/pdf",
        )
        classification = classify_media(upload)

        result = sanitize_media(upload, classification)

        self.assertFalse(result.converted)
        self.assertEqual(result.file_name, "document.pdf")
        self.assertEqual(result.file_type, "application/pdf")

    @override_settings(MEDIA_MAX_FILENAME_LENGTH=20)
    def test_sanitizes_special_characters_and_truncates_long_names(self) -> None:
        upload = SimpleUploadedFile(
            "a very long & special filename.png",
            image_bytes(),
            content_type="image/png",
        )
        classification = classify_media(upload)

        result = sanitize_media(upload, classification)

        self.assertEqual(len(result.file_name), 20)
        self.assertEqual(result.file_name, "a_very_long___sp.png")
        self.assertNotRegex(result.file_name, r"[^a-zA-Z0-9_.-]")


@override_settings(STORAGES=TEST_STORAGES)
class MediaUploadApiTests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()

    def test_upload_stores_sanitized_png_mime_type(self) -> None:
        upload = SimpleUploadedFile(
            "photo.PNG",
            image_bytes(),
            content_type="image/png",
        )

        response = self.client.post("/api/media/upload/", {"image": upload}, format="multipart")

        self.assertEqual(response.status_code, 201)
        media = MediaAsset.objects.get()
        self.assertEqual(media.file_type, "image/png")
        self.assertTrue(media.file_name.endswith(".png"))
        self.assertEqual(response.data["media_asset_id"], media.pk)

    def test_upload_rejects_invalid_media_without_creating_asset(self) -> None:
        upload = SimpleUploadedFile("photo.jpg", b"not an image", content_type="image/jpeg")

        response = self.client.post("/api/media/upload/", {"image": upload}, format="multipart")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "invalid_media")
        self.assertEqual(MediaAsset.objects.count(), 0)

    def test_upload_rejects_corrupt_image_without_creating_asset(self) -> None:
        upload = SimpleUploadedFile(
            "photo.png",
            b"\x89PNG\r\n\x1a\nnot a complete png",
            content_type="image/png",
        )

        response = self.client.post("/api/media/upload/", {"image": upload}, format="multipart")

        self.assertEqual(response.status_code, 400)
        self.assertIn("image_content_invalid", response.data["details"]["reasons"])
        self.assertEqual(MediaAsset.objects.count(), 0)

    def test_upload_rejects_missing_file(self) -> None:
        response = self.client.post("/api/media/upload/", {}, format="multipart")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "No file provided.")
        self.assertEqual(MediaAsset.objects.count(), 0)
