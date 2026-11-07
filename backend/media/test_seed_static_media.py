from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings
from PIL import Image

from media.management.commands.seed_static_media import STATIC_MEDIA_SEEDS
from media.models import MediaAsset, StaticImage
from media.persistence import MediaPersistenceError

TEST_STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.InMemoryStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}


def write_image(path: Path, image_format: str) -> None:
    """Create a small valid image for command tests."""
    image = Image.new("RGB", (2, 2), color=(0, 128, 128))
    image.save(path, format=image_format)


@override_settings(STORAGES=TEST_STORAGES)
class SeedStaticMediaCommandTests(TestCase):
    """Verify safe initialization of the reserved static media slots."""

    def setUp(self) -> None:
        self.temporary_directory = TemporaryDirectory()
        self.asset_directory = Path(self.temporary_directory.name)
        write_image(self.asset_directory / "Placeholder.png", "PNG")
        write_image(self.asset_directory / "Banner.webp", "WEBP")

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def command_args(self, *extra: str) -> list[str]:
        return [
            "--placeholder",
            str(self.asset_directory / "Placeholder.png"),
            "--banner",
            str(self.asset_directory / "Banner.webp"),
            *extra,
        ]

    def test_command_creates_reserved_slots_and_uploads_assets(self) -> None:
        call_command("seed_static_media", *self.command_args())

        self.assertEqual(
            list(
                StaticImage.objects.values_list(
                    "static_image_id", "display_name", "media_asset_id"
                )
            ),
            [(0, "Placeholder", 1), (1, "Banner", 2)],
        )
        self.assertEqual(MediaAsset.objects.count(), 2)
        self.assertEqual(
            set(MediaAsset.objects.values_list("file_name", flat=True)),
            {"Placeholder.png", "Banner.webp"},
        )

        for media_asset in MediaAsset.objects.all():
            self.assertTrue(media_asset.file.storage.exists(media_asset.file.name))

    def test_command_is_idempotent(self) -> None:
        call_command("seed_static_media", *self.command_args())
        call_command("seed_static_media", *self.command_args())

        self.assertEqual(StaticImage.objects.count(), 2)
        self.assertEqual(MediaAsset.objects.count(), 2)

    def test_command_accepts_filename_stems_and_supported_extensions(self) -> None:
        with TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            default_assets = root / "frontend" / "assets"
            backend_directory = root / "backend"
            backend_directory.mkdir()
            default_assets.mkdir(parents=True)
            write_image(default_assets / "Placeholder.jpg", "JPEG")
            write_image(default_assets / "Banner.png", "PNG")

            with override_settings(BASE_DIR=backend_directory):
                call_command(
                    "seed_static_media",
                    "--placeholder",
                    "Placeholder",
                    "--banner",
                    "Banner.png",
                )

        self.assertEqual(
            set(MediaAsset.objects.values_list("file_name", flat=True)),
            {"Placeholder.jpg", "Banner.png"},
        )

    def test_command_preserves_existing_link_and_fills_missing_slot(self) -> None:
        existing = MediaAsset.objects.create(
            file=ContentFile(b"existing", name="existing.png"),
            file_name="existing.png",
            file_type="image/png",
            file_size=8,
            alt_text_en="Existing asset",
        )
        StaticImage.objects.create(
            static_image_id=0,
            display_name="Custom Placeholder",
            media_asset=existing,
        )

        call_command("seed_static_media", *self.command_args())

        placeholder = StaticImage.objects.get(static_image_id=0)
        banner = StaticImage.objects.get(static_image_id=1)
        self.assertEqual(placeholder.display_name, "Custom Placeholder")
        self.assertEqual(placeholder.media_asset_id, existing.pk)
        self.assertIsNotNone(banner.media_asset_id)
        self.assertEqual(MediaAsset.objects.count(), 2)

    def test_dry_run_validates_without_writing(self) -> None:
        call_command("seed_static_media", *self.command_args("--dry-run"))

        self.assertEqual(StaticImage.objects.count(), 0)
        self.assertEqual(MediaAsset.objects.count(), 0)

    def test_missing_asset_fails_before_writing(self) -> None:
        missing_path = self.asset_directory / "missing.png"

        with self.assertRaises(CommandError):
            call_command(
                "seed_static_media",
                "--placeholder",
                str(missing_path),
                "--banner",
                str(self.asset_directory / "Banner.webp"),
            )

        self.assertEqual(StaticImage.objects.count(), 0)
        self.assertEqual(MediaAsset.objects.count(), 0)

    def test_invalid_asset_fails_validation(self) -> None:
        invalid_path = self.asset_directory / "invalid.png"
        invalid_path.write_bytes(b"not an image")

        with self.assertRaises(CommandError):
            call_command(
                "seed_static_media",
                "--placeholder",
                str(invalid_path),
                "--banner",
                str(self.asset_directory / "Banner.webp"),
            )

        self.assertEqual(MediaAsset.objects.count(), 0)

    @override_settings(MEDIA_MAX_UPLOAD_SIZE_BYTES=1)
    def test_oversized_asset_fails_validation(self) -> None:
        with self.assertRaises(CommandError):
            call_command("seed_static_media", *self.command_args())

        self.assertEqual(MediaAsset.objects.count(), 0)

    def test_storage_is_cleaned_when_second_asset_fails(self) -> None:
        from media.management.commands import seed_static_media

        real_persist = seed_static_media.persist_media_asset
        call_count = 0
        created_media_assets = []

        def persist_first_then_fail(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 2:
                raise MediaPersistenceError("simulated storage failure")
            media_asset = real_persist(*args, **kwargs)
            created_media_assets.append(media_asset)
            return media_asset

        with patch.object(
            seed_static_media,
            "persist_media_asset",
            side_effect=persist_first_then_fail,
        ):
            with self.assertRaises(CommandError):
                call_command("seed_static_media", *self.command_args())

        self.assertEqual(StaticImage.objects.count(), 0)
        self.assertEqual(MediaAsset.objects.count(), 0)
        self.assertEqual(len(created_media_assets), 1)
        created_media = created_media_assets[0]
        self.assertFalse(created_media.file.storage.exists(created_media.file.name))

    def test_default_asset_paths_use_repository_layout(self) -> None:
        with TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            default_assets = root / "frontend" / "assets"
            backend_directory = root / "backend"
            backend_directory.mkdir()
            default_assets.mkdir(parents=True)
            write_image(default_assets / "Placeholder.png", "PNG")
            write_image(default_assets / "Banner.webp", "WEBP")

            with override_settings(BASE_DIR=backend_directory):
                call_command("seed_static_media")

        self.assertEqual(StaticImage.objects.count(), len(STATIC_MEDIA_SEEDS))
