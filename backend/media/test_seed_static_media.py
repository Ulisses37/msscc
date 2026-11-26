from io import StringIO
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


def write_pdf(path: Path) -> None:
    """Create a minimal PDF accepted by the media validation pipeline."""
    path.write_bytes(b"%PDF-1.7\nminimal document\n%%EOF\n")


@override_settings(STORAGES=TEST_STORAGES)
class SeedStaticMediaCommandTests(TestCase):
    """Verify safe initialization of the reserved static media slots."""

    def setUp(self) -> None:
        self.temporary_directory = TemporaryDirectory()
        self.asset_directory = Path(self.temporary_directory.name)
        write_image(self.asset_directory / "Placeholder.png", "PNG")
        write_image(self.asset_directory / "Banner.webp", "WEBP")
        write_pdf(self.asset_directory / "Printable_Membership_Form.pdf")
        write_image(self.asset_directory / "Officer_Default.png", "PNG")

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def command_args(self, *extra: str) -> list[str]:
        return [
            "--placeholder",
            str(self.asset_directory / "Placeholder.png"),
            "--banner",
            str(self.asset_directory / "Banner.webp"),
            "--membership-form",
            str(self.asset_directory / "Printable_Membership_Form.pdf"),
            "--officer-default",
            str(self.asset_directory / "Officer_Default.png"),
            *extra,
        ]

    def test_command_creates_reserved_slots_and_uploads_assets(self) -> None:
        output = StringIO()
        call_command("seed_static_media", *self.command_args(), stdout=output)

        self.assertEqual(
            list(
                StaticImage.objects.values_list(
                    "static_image_id", "display_name", "media_asset_id"
                )
            ),
            [
                (0, "Placeholder", 1),
                (1, "Banner", 2),
                (2, "Printable Membership Form", 3),
                (3, "Officer Default Image", 4),
            ],
        )
        self.assertEqual(MediaAsset.objects.count(), 4)
        self.assertEqual(
            set(MediaAsset.objects.values_list("file_name", flat=True)),
            {
                "Placeholder.png",
                "Banner.webp",
                "Printable_Membership_Form.pdf",
                "Officer_Default.png",
            },
        )

        for media_asset in MediaAsset.objects.all():
            self.assertTrue(media_asset.file.storage.exists(media_asset.file.name))
        self.assertIn("Created: 4; linked: 4; skipped: 0.", output.getvalue())

    def test_command_is_idempotent(self) -> None:
        call_command("seed_static_media", *self.command_args(), stdout=StringIO())
        output = StringIO()
        call_command("seed_static_media", *self.command_args(), stdout=output)

        self.assertEqual(StaticImage.objects.count(), 4)
        self.assertEqual(MediaAsset.objects.count(), 4)
        self.assertIn("Created: 0; linked: 0; skipped: 4.", output.getvalue())

    def test_command_accepts_filename_stems_and_supported_extensions(self) -> None:
        with TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            backend_directory = root / "backend"
            default_assets = backend_directory / "media" / "seed_data"
            backend_directory.mkdir()
            default_assets.mkdir(parents=True)
            write_image(default_assets / "Placeholder.jpg", "JPEG")
            write_image(default_assets / "Banner.png", "PNG")
            write_pdf(default_assets / "Printable_Membership_Form.pdf")
            write_image(default_assets / "Officer_Default.jpg", "JPEG")

            with override_settings(BASE_DIR=backend_directory):
                call_command(
                    "seed_static_media",
                    "--placeholder",
                    "Placeholder",
                    "--banner",
                    "Banner.png",
                    "--membership-form",
                    "Printable_Membership_Form",
                    "--officer-default",
                    "Officer_Default",
                )

        self.assertEqual(
            set(MediaAsset.objects.values_list("file_name", flat=True)),
            {
                "Placeholder.jpg",
                "Banner.png",
                "Printable_Membership_Form.pdf",
                "Officer_Default.jpg",
            },
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

        output = StringIO()
        call_command("seed_static_media", *self.command_args(), stdout=output)

        placeholder = StaticImage.objects.get(static_image_id=0)
        banner = StaticImage.objects.get(static_image_id=1)
        membership_form = StaticImage.objects.get(static_image_id=2)
        officer_default = StaticImage.objects.get(static_image_id=3)
        self.assertEqual(placeholder.display_name, "Custom Placeholder")
        self.assertEqual(placeholder.media_asset_id, existing.pk)
        self.assertIsNotNone(banner.media_asset_id)
        self.assertIsNotNone(membership_form.media_asset_id)
        self.assertIsNotNone(officer_default.media_asset_id)
        self.assertEqual(MediaAsset.objects.count(), 4)
        self.assertIn("Created: 3; linked: 3; skipped: 1.", output.getvalue())

    def test_command_links_existing_unlinked_slot_and_creates_missing_slot(self) -> None:
        StaticImage.objects.create(
            static_image_id=0,
            display_name="Custom Placeholder",
        )

        output = StringIO()
        call_command("seed_static_media", *self.command_args(), stdout=output)

        placeholder = StaticImage.objects.get(static_image_id=0)
        banner = StaticImage.objects.get(static_image_id=1)
        membership_form = StaticImage.objects.get(static_image_id=2)
        officer_default = StaticImage.objects.get(static_image_id=3)
        self.assertEqual(placeholder.display_name, "Custom Placeholder")
        self.assertIsNotNone(placeholder.media_asset_id)
        self.assertIsNotNone(banner.media_asset_id)
        self.assertIsNotNone(membership_form.media_asset_id)
        self.assertIsNotNone(officer_default.media_asset_id)
        self.assertEqual(MediaAsset.objects.count(), 4)
        self.assertIn("Created: 3; linked: 4; skipped: 0.", output.getvalue())

    def test_dry_run_validates_without_writing(self) -> None:
        call_command("seed_static_media", *self.command_args("--dry-run"))

        self.assertEqual(StaticImage.objects.count(), 0)
        self.assertEqual(MediaAsset.objects.count(), 0)

    def test_repository_default_assets_validate_without_writing(self) -> None:
        call_command("seed_static_media", "--dry-run")

        self.assertEqual(StaticImage.objects.count(), 0)
        self.assertEqual(MediaAsset.objects.count(), 0)

    def test_empty_creates_reserved_slots_without_assets_or_storage(self) -> None:
        output = StringIO()

        with patch(
            "media.management.commands.seed_static_media.persist_media_asset"
        ) as persist_media_asset:
            call_command("seed_static_media", "--empty", stdout=output)

        self.assertEqual(
            list(
                StaticImage.objects.values_list(
                    "static_image_id", "display_name", "media_asset_id"
                )
            ),
            [
                (0, "Placeholder", None),
                (1, "Banner", None),
                (2, "Printable Membership Form", None),
                (3, "Officer Default Image", None),
            ],
        )
        self.assertEqual(MediaAsset.objects.count(), 0)
        persist_media_asset.assert_not_called()
        self.assertIn("Created: 4; linked: 0; skipped: 0.", output.getvalue())

    def test_empty_dry_run_does_not_require_source_assets(self) -> None:
        (self.asset_directory / "Placeholder.png").unlink()
        (self.asset_directory / "Banner.webp").unlink()
        (self.asset_directory / "Printable_Membership_Form.pdf").unlink()
        (self.asset_directory / "Officer_Default.png").unlink()

        output = StringIO()
        call_command(
            "seed_static_media",
            *self.command_args("--empty", "--dry-run"),
            stdout=output,
        )

        self.assertEqual(StaticImage.objects.count(), 0)
        self.assertEqual(MediaAsset.objects.count(), 0)
        self.assertIn("Would create empty static media: Placeholder (0)", output.getvalue())
        self.assertIn("Would create empty static media: Banner (1)", output.getvalue())
        self.assertIn(
            "Would create empty static media: Printable Membership Form (2)",
            output.getvalue(),
        )
        self.assertIn(
            "Would create empty static media: Officer Default Image (3)",
            output.getvalue(),
        )

    def test_missing_asset_fails_before_writing(self) -> None:
        missing_path = self.asset_directory / "missing.png"

        with self.assertRaises(CommandError):
            call_command(
                "seed_static_media",
                "--placeholder",
                str(missing_path),
                "--banner",
                str(self.asset_directory / "Banner.webp"),
                "--membership-form",
                str(self.asset_directory / "Printable_Membership_Form.pdf"),
                "--officer-default",
                str(self.asset_directory / "Officer_Default.png"),
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
                "--membership-form",
                str(self.asset_directory / "Printable_Membership_Form.pdf"),
                "--officer-default",
                str(self.asset_directory / "Officer_Default.png"),
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

    def test_default_asset_paths_use_backend_only_layout(self) -> None:
        with TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            backend_directory = root / "backend"
            default_assets = backend_directory / "media" / "seed_data"
            backend_directory.mkdir()
            default_assets.mkdir(parents=True)
            write_image(default_assets / "Placeholder.png", "PNG")
            write_image(default_assets / "Banner.webp", "WEBP")
            write_pdf(default_assets / "Printable_Membership_Form.pdf")
            write_image(default_assets / "Officer_Default.png", "PNG")

            with override_settings(BASE_DIR=backend_directory):
                call_command("seed_static_media")

        self.assertEqual(StaticImage.objects.count(), len(STATIC_MEDIA_SEEDS))
