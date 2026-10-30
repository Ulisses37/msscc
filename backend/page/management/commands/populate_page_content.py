import logging
from pathlib import Path

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Max

from content.models import Content
from media.classification import classify_media
from media.models import MediaAsset
from media.persistence import MediaPersistenceError, persist_media_asset
from media.sanitization import MediaSanitizationError, sanitize_media
from media.validation import validate_media
from page.models import Page
from page.page_content_import import (
    PageContentDocumentError,
    ParsedContentBlock,
    parse_page_content_document,
)
from page.page_content_translations import PAGE_CONTENT_JA

logger = logging.getLogger(__name__)
IMPORT_KEY_PREFIX = "scrum-845:pagecontent:"
DEFAULT_DOCUMENT_PATH = Path(settings.BASE_DIR).parent / "docs" / "pagecontent.docx"


class Command(BaseCommand):
    """Populate or roll back the public page content defined in pagecontent.docx."""

    help = "Populate public page-editor content from docs/pagecontent.docx."

    def add_arguments(self, parser) -> None:
        """Register document, dry-run, and rollback command options."""
        parser.add_argument(
            "--document",
            type=Path,
            default=DEFAULT_DOCUMENT_PATH,
            help="Path to the page-content DOCX file.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse and validate the document without writing data or files.",
        )
        parser.add_argument(
            "--rollback",
            action="store_true",
            help="Remove only content and media created by this importer.",
        )

    def handle(self, *args, **options) -> None:
        """Validate the document, populate missing blocks, or roll back imported rows."""
        if options["rollback"]:
            if options["dry_run"]:
                raise CommandError("--dry-run and --rollback cannot be used together.")
            self._rollback()
            return

        document_path = options["document"].resolve()
        try:
            blocks = parse_page_content_document(document_path)
        except PageContentDocumentError as exc:
            raise CommandError(str(exc)) from exc

        self._validate_translations(blocks)
        self._validate_pages(blocks)
        self._validate_images(blocks)

        if options["dry_run"]:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Dry run complete. Validated {len(blocks)} blocks from {document_path}."
                )
            )
            return

        self._populate(blocks)

    def _validate_translations(self, blocks: list[ParsedContentBlock]) -> None:
        parsed_keys = {block.import_key for block in blocks}
        translation_keys = set(PAGE_CONTENT_JA)
        missing_keys = sorted(parsed_keys - translation_keys)
        if missing_keys:
            raise CommandError(
                "Translation mapping does not match the document; missing translations: "
                + ", ".join(missing_keys)
            )

    def _validate_pages(self, blocks: list[ParsedContentBlock]) -> None:
        page_slugs = {block.page_slug for block in blocks}
        existing_slugs = set(
            Page.objects.filter(page_slug__in=page_slugs).values_list("page_slug", flat=True)
        )
        missing_slugs = sorted(page_slugs - existing_slugs)
        if missing_slugs:
            raise CommandError(
                "Missing page records: "
                f"{', '.join(missing_slugs)}. Run seed_pages before this command."
            )

    def _build_upload(self, block: ParsedContentBlock) -> SimpleUploadedFile:
        if not block.image_name or block.image_bytes is None or not block.image_content_type:
            raise CommandError(f"Image block {block.import_key} has incomplete media data.")
        return SimpleUploadedFile(
            block.image_name,
            block.image_bytes,
            content_type=block.image_content_type,
        )

    def _validate_images(self, blocks: list[ParsedContentBlock]) -> None:
        for block in blocks:
            if block.content_type != "image":
                continue
            upload = self._build_upload(block)
            classification = classify_media(upload)
            if not classification.is_valid:
                raise CommandError(
                    f"Image {block.image_name} failed classification: "
                    f"{', '.join(classification.reasons)}."
                )
            validation = validate_media(upload, classification)
            if not validation.is_valid:
                raise CommandError(
                    f"Image {block.image_name} failed validation: "
                    f"{', '.join(validation.reasons)}."
                )
            try:
                sanitize_media(upload, classification)
            except MediaSanitizationError as exc:
                raise CommandError(
                    f"Image {block.image_name} failed sanitization: {exc.reason}."
                ) from exc

    def _create_media(self, block: ParsedContentBlock) -> MediaAsset:
        upload = self._build_upload(block)
        classification = classify_media(upload)
        sanitized_media = sanitize_media(upload, classification)
        try:
            return persist_media_asset(
                sanitized_media,
                alt_text_en=block.content_en,
                alt_text_ja=PAGE_CONTENT_JA[block.import_key],
            )
        except MediaPersistenceError as exc:
            raise CommandError(f"Unable to store image {block.image_name}.") from exc

    def _populate(self, blocks: list[ParsedContentBlock]) -> None:
        existing_keys = set(
            Content.objects.filter(import_key__startswith=IMPORT_KEY_PREFIX).values_list(
                "import_key",
                flat=True,
            )
        )
        missing_blocks = [block for block in blocks if block.import_key not in existing_keys]
        if not missing_blocks:
            self.stdout.write(self.style.SUCCESS("Page content is already populated."))
            return

        pages = {
            page.page_slug: page
            for page in Page.objects.filter(
                page_slug__in={block.page_slug for block in missing_blocks}
            )
        }
        next_orders = {
            page_slug: (
                Content.objects.filter(page_id=page).aggregate(Max("display_order"))[
                    "display_order__max"
                ]
                or 0
            )
            + 1
            for page_slug, page in pages.items()
        }
        created_media: list[MediaAsset] = []

        try:
            with transaction.atomic():
                for block in missing_blocks:
                    media_asset = None
                    if block.content_type == "image":
                        media_asset = self._create_media(block)
                        created_media.append(media_asset)

                    Content.objects.create(
                        page_id=pages[block.page_slug],
                        display_order=next_orders[block.page_slug],
                        content_type=block.content_type,
                        media_asset=media_asset,
                        content_en=block.content_en,
                        content_ja=PAGE_CONTENT_JA[block.import_key],
                        # Imported images use the Page Editor's centered, half-width layout.
                        image_alignment="center",
                        image_width=50,
                        import_key=block.import_key,
                    )
                    next_orders[block.page_slug] += 1
        except Exception:
            # Database transactions cannot roll back object-storage writes, so remove
            # each file created before the failure and then re-raise the original error.
            for media_asset in created_media:
                self._delete_media_asset(media_asset)
            raise

        skipped_count = len(blocks) - len(missing_blocks)
        self.stdout.write(
            self.style.SUCCESS(
                "Page content population complete. "
                f"Created: {len(missing_blocks)}; existing: {skipped_count}."
            )
        )

    def _rollback(self) -> None:
        imported_content = list(
            Content.objects.filter(import_key__startswith=IMPORT_KEY_PREFIX).select_related(
                "media_asset"
            )
        )
        media_assets = [
            content.media_asset
            for content in imported_content
            if content.media_asset is not None
        ]

        with transaction.atomic():
            deleted_count, _ = Content.objects.filter(
                import_key__startswith=IMPORT_KEY_PREFIX
            ).delete()

        for media_asset in media_assets:
            if not self._media_asset_is_referenced(media_asset):
                self._delete_media_asset(media_asset)

        self.stdout.write(
            self.style.SUCCESS(
                f"Page content rollback complete. Removed: {deleted_count}."
            )
        )

    def _media_asset_is_referenced(self, media_asset: MediaAsset) -> bool:
        """Return whether any remaining model record still uses the media asset."""
        for relation in MediaAsset._meta.related_objects:
            if relation.related_model.objects.filter(
                **{relation.field.name: media_asset}
            ).exists():
                return True
        return False

    def _delete_media_asset(self, media_asset: MediaAsset) -> None:
        file_name = media_asset.file.name
        storage = media_asset.file.storage
        try:
            if file_name:
                storage.delete(file_name)
            media_asset.delete()
        except Exception:
            logger.exception(
                "Failed to remove imported media asset %s during cleanup.",
                media_asset.pk,
            )
