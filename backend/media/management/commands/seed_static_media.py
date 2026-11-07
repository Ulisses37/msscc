"""Seed the reusable static media required by the public website."""

import logging
from dataclasses import dataclass
from pathlib import Path

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import connection, transaction

from media.classification import SUPPORTED_MEDIA, classify_media
from media.models import MediaAsset, StaticImage
from media.persistence import MediaPersistenceError, persist_media_asset
from media.sanitization import MediaSanitizationError, SanitizedMedia, sanitize_media
from media.validation import validate_media

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class StaticMediaSeed:
    """Describe one reserved static-image slot and its source asset."""

    static_image_id: int
    display_name: str
    file_name: str
    content_type: str
    alt_text_en: str


STATIC_MEDIA_SEEDS = (
    StaticMediaSeed(
        static_image_id=0,
        display_name="Placeholder",
        file_name="Placeholder.png",
        content_type="image/png",
        alt_text_en="Placeholder",
    ),
    StaticMediaSeed(
        static_image_id=1,
        display_name="Banner",
        file_name="Banner.webp",
        content_type="image/webp",
        alt_text_en="Banner",
    ),
)

ACCEPTED_IMAGE_EXTENSIONS = tuple(
    extension
    for supported_media in SUPPORTED_MEDIA
    if supported_media.kind == "image"
    for extension in supported_media.extensions
)


class Command(BaseCommand):
    """Create and upload the website's reserved static media slots."""

    help = "Seed the Placeholder and Banner static media records."

    def add_arguments(self, parser) -> None:
        """Register optional source paths and validation-only mode."""
        parser.add_argument(
            "--placeholder",
            type=Path,
            help=(
                "Path or filename for the placeholder image; the extension may be omitted "
                "(defaults to frontend/assets/Placeholder.png)."
            ),
        )
        parser.add_argument(
            "--banner",
            type=Path,
            help=(
                "Path or filename for the banner image; the extension may be omitted "
                "(defaults to frontend/assets/Banner.webp)."
            ),
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Validate assets and report actions without writing database or storage state.",
        )

    def handle(self, *args, **options) -> None:
        """Validate and seed any missing static media associations."""
        paths = {
            0: self._resolve_path(options.get("placeholder"), STATIC_MEDIA_SEEDS[0]),
            1: self._resolve_path(options.get("banner"), STATIC_MEDIA_SEEDS[1]),
        }
        slots = self._load_slots()
        pending_seeds = [
            seed
            for seed in STATIC_MEDIA_SEEDS
            if slots.get(seed.static_image_id) is None
            or slots[seed.static_image_id].media_asset_id is None
        ]
        already_linked_count = sum(
            slot is not None and slot.media_asset_id is not None for slot in slots.values()
        )

        if options["dry_run"]:
            self._dry_run(slots, pending_seeds, paths)
            return

        prepared_media = {
            seed.static_image_id: self._prepare_media(seed, paths[seed.static_image_id])
            for seed in pending_seeds
        }
        self._seed(slots, pending_seeds, prepared_media, already_linked_count)

    def _resolve_path(self, supplied_path: Path | None, seed: StaticMediaSeed) -> Path:
        """Resolve a CLI path or filename, trying accepted image extensions."""
        default_directory = Path(settings.BASE_DIR).parent / "frontend" / "assets"
        if supplied_path is None:
            path = default_directory / seed.file_name
        else:
            path = supplied_path.expanduser()
            if not path.is_absolute() and len(path.parts) == 1:
                path = default_directory / path

        if path.is_file():
            return path.resolve()

        # A missing default with an extension, or an explicitly supplied extension, should
        # report that exact missing path rather than silently selecting a different file.
        if path.suffix and supplied_path is not None:
            return path.resolve()

        extension_order = [Path(seed.file_name).suffix.lower()]
        extension_order.extend(
            extension
            for extension in ACCEPTED_IMAGE_EXTENSIONS
            if extension not in extension_order
        )
        for extension in extension_order:
            candidate = path.with_suffix(extension)
            if candidate.is_file():
                return candidate.resolve()

        return path.resolve()

    def _load_slots(self) -> dict[int, StaticImage]:
        """Load the reserved slots used to determine which work is necessary."""
        return StaticImage.objects.in_bulk([seed.static_image_id for seed in STATIC_MEDIA_SEEDS])

    def _build_upload(self, seed: StaticMediaSeed, path: Path) -> SimpleUploadedFile:
        """Read a source asset into the same upload representation used by the API."""
        if not path.is_file():
            raise CommandError(f"Static media source does not exist: {path}")

        try:
            contents = path.read_bytes()
        except OSError as exc:
            raise CommandError(f"Unable to read static media source: {path}") from exc

        return SimpleUploadedFile(
            path.name,
            contents,
            content_type=self._content_type_for_path(path, seed),
        )

    def _content_type_for_path(self, path: Path, seed: StaticMediaSeed) -> str:
        """Use the MIME type associated with an accepted source extension."""
        extension = path.suffix.lower()
        for supported_media in SUPPORTED_MEDIA:
            if extension in supported_media.extensions:
                return supported_media.mime_type
        return seed.content_type

    def _prepare_media(self, seed: StaticMediaSeed, path: Path) -> SanitizedMedia:
        """Classify, validate, and sanitize one source asset before any writes."""
        upload = self._build_upload(seed, path)
        classification = classify_media(upload)
        if not classification.is_valid:
            reasons = ", ".join(classification.reasons)
            raise CommandError(f"{seed.display_name} failed classification: {reasons}.")

        validation = validate_media(upload, classification)
        if not validation.is_valid:
            reasons = ", ".join(validation.reasons)
            raise CommandError(f"{seed.display_name} failed validation: {reasons}.")

        try:
            return sanitize_media(upload, classification)
        except MediaSanitizationError as exc:
            raise CommandError(
                f"{seed.display_name} failed sanitization: {exc.reason}."
            ) from exc

    def _dry_run(
        self,
        slots: dict[int, StaticImage],
        pending_seeds: list[StaticMediaSeed],
        paths: dict[int, Path],
    ) -> None:
        """Validate pending assets and describe the actions without persisting them."""
        pending_ids = {seed.static_image_id for seed in pending_seeds}
        for seed in STATIC_MEDIA_SEEDS:
            slot = slots.get(seed.static_image_id)
            if seed.static_image_id not in pending_ids:
                self.stdout.write(
                    f"Would skip {seed.display_name} ({seed.static_image_id}): already linked."
                )
                continue

            self._prepare_media(seed, paths[seed.static_image_id])
            action = "create and link" if slot is None else "link"
            self.stdout.write(
                f"Would {action} {seed.display_name} (ID: {seed.static_image_id}) from "
                f"{paths[seed.static_image_id]}"
            )

        self.stdout.write(self.style.SUCCESS("Static media dry run complete."))

    def _seed(
        self,
        slots: dict[int, StaticImage],
        pending_seeds: list[StaticMediaSeed],
        prepared_media: dict[int, SanitizedMedia],
        already_linked_count: int,
    ) -> None:
        """Persist pending media and associations, cleaning storage on failure."""
        created_media: list[MediaAsset] = []
        created_slots = 0
        linked_slots = 0
        skipped_slots = already_linked_count

        try:
            with transaction.atomic():
                current_slots = self._load_slots()
                for seed in pending_seeds:
                    slot = current_slots.get(seed.static_image_id)
                    if slot is not None and slot.media_asset_id is not None:
                        skipped_slots += 1
                        self.stdout.write(
                            f"Static media already linked: {seed.display_name} "
                            f"({seed.static_image_id})"
                        )
                        continue

                    try:
                        media_asset = persist_media_asset(
                            prepared_media[seed.static_image_id],
                            alt_text_en=seed.alt_text_en,
                            alt_text_ja="",
                        )
                    except MediaPersistenceError:
                        raise

                    created_media.append(media_asset)
                    if slot is None:
                        StaticImage.objects.create(
                            static_image_id=seed.static_image_id,
                            display_name=seed.display_name,
                            media_asset=media_asset,
                        )
                        created_slots += 1
                        linked_slots += 1
                        self.stdout.write(
                            f"Created static media: {seed.display_name} "
                            f"({seed.static_image_id})"
                        )
                    else:
                        slot.media_asset = media_asset
                        slot.save(update_fields=["media_asset"])
                        linked_slots += 1
                        self.stdout.write(
                            f"Linked static media: {seed.display_name} "
                            f"({seed.static_image_id})"
                        )

                if created_slots:
                    self._reset_sequence()
        except MediaPersistenceError as exc:
            self._cleanup_media(created_media)
            raise CommandError("Unable to store seeded static media.") from exc
        except Exception:
            self._cleanup_media(created_media)
            raise

        self.stdout.write(
            self.style.SUCCESS(
                "Static media seed complete. "
                f"Created: {created_slots}; linked: {linked_slots}; skipped: {skipped_slots}."
            )
        )

    def _reset_sequence(self) -> None:
        """Keep future AutoField-generated IDs above the explicit reserved IDs."""
        statements = connection.ops.sequence_reset_sql(no_style(), [StaticImage])
        with connection.cursor() as cursor:
            for statement in statements:
                cursor.execute(statement)

    def _cleanup_media(self, media_assets: list[MediaAsset]) -> None:
        """Remove storage objects created before a failed transaction."""
        for media_asset in reversed(media_assets):
            file_name = media_asset.file.name
            storage = media_asset.file.storage
            try:
                if file_name:
                    storage.delete(file_name)
                media_asset.delete()
            except Exception:
                logger.exception(
                    "Failed to remove seeded media asset %s during cleanup.",
                    media_asset.pk,
                )
