from io import BytesIO, StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from zipfile import ZipFile

from django.core.management import call_command
from django.test import TestCase, override_settings
from PIL import Image

from content.models import Content
from media.models import MediaAsset, StaticImage
from page.models import Page
from page.page_content_import import ParsedContentBlock, parse_page_content_document

TEST_STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.InMemoryStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}


def image_bytes() -> bytes:
    """Return a small valid PNG for parser and command tests."""
    output = BytesIO()
    Image.new("RGB", (2, 2), color=(0, 128, 128)).save(output, format="PNG")
    return output.getvalue()


def write_test_document(document_path: Path) -> None:
    """Create a minimal DOCX package with text, an image, and an empty caption."""
    document_xml = """<?xml version="1.0" encoding="UTF-8"?>
<w:document
    xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
    xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p><w:r><w:t>Home</w:t></w:r></w:p>
    <w:p>
      <w:r><w:t>Paragraph: First </w:t></w:r>
      <w:r><w:rPr><w:b /></w:rPr><w:t>bold</w:t></w:r>
      <w:r><w:t> &amp; &lt;safe&gt; paragraph.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:numPr><w:ilvl w:val="0" /><w:numId w:val="1" /></w:numPr></w:pPr>
      <w:r><w:t>Second paragraph.</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t>Image:</w:t></w:r></w:p>
    <w:p><w:r><w:drawing><a:blip r:embed="rId1" /></w:drawing></w:r></w:p>
    <w:p><w:r><w:t>Caption:</w:t></w:r></w:p>
  </w:body>
</w:document>
"""
    relationships_xml = """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship
      Id="rId1"
      Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"
      Target="media/test-image.png" />
</Relationships>
"""

    with ZipFile(document_path, "w") as archive:
        archive.writestr("word/document.xml", document_xml)
        archive.writestr("word/_rels/document.xml.rels", relationships_xml)
        archive.writestr("word/media/test-image.png", image_bytes())


class PageContentDocumentParserTests(TestCase):
    """Tests for converting the documented DOCX structure into page-editor blocks."""

    def test_parser_groups_unlabeled_paragraphs_and_extracts_uncaptioned_image(self) -> None:
        """A continuation paragraph stays in one block and an empty caption stays empty."""
        with TemporaryDirectory() as temporary_directory:
            document_path = Path(temporary_directory) / "pagecontent.docx"
            write_test_document(document_path)

            blocks = parse_page_content_document(document_path)

        # Tests: paragraph grouping, bold runs, list markers, and empty image captions.
        # Expected output: safe rich text and one star-prefixed item share one paragraph block.
        self.assertEqual(len(blocks), 2)
        self.assertEqual(blocks[0].page_slug, "home")
        self.assertEqual(blocks[0].content_type, "paragraph")
        self.assertEqual(
            blocks[0].content_en,
            (
                "First <strong>bold</strong> &amp; &lt;safe&gt; paragraph."
                "\n\n* Second paragraph."
            ),
        )
        self.assertEqual(blocks[1].content_type, "image")
        self.assertEqual(blocks[1].content_en, "")
        self.assertEqual(blocks[1].image_name, "test-image.png")
        self.assertEqual(blocks[1].image_bytes, image_bytes())


@override_settings(STORAGES=TEST_STORAGES)
class PopulatePageContentCommandTests(TestCase):
    """Tests for safe population, repeat runs, and rollback of imported content."""

    def setUp(self) -> None:
        self.page = Page.objects.create(
            page_slug="home",
            page_title_en="Home",
            page_title_ja="ホーム",
        )
        self.blocks = [
            ParsedContentBlock(
                page_slug="home",
                content_type="header",
                content_en="Welcome",
                import_key="scrum-845:pagecontent:home:001",
            ),
            ParsedContentBlock(
                page_slug="home",
                content_type="image",
                content_en="View from Matsuyama Castle overlooking the Ehime Prefecture, Japan.",
                import_key="scrum-845:pagecontent:home:003",
                image_name="castle.png",
                image_bytes=image_bytes(),
                image_content_type="image/png",
            ),
        ]

    def run_command(self, *args: str) -> str:
        """Run the command with a deterministic parsed document and capture its output."""
        output = StringIO()
        with patch(
            "page.management.commands.populate_page_content.parse_page_content_document",
            return_value=self.blocks,
        ):
            call_command("populate_page_content", *args, stdout=output)
        return output.getvalue()

    def test_dry_run_validates_without_writing_content_or_media(self) -> None:
        """Dry-run mode reports success without changing database or storage state."""
        # Tests: the documented validation-only command.
        # Expected output: success output with no Content or MediaAsset rows created.
        output = self.run_command("--dry-run")

        self.assertIn("Dry run complete", output)
        self.assertEqual(Content.objects.count(), 0)
        self.assertEqual(MediaAsset.objects.count(), 0)

    def test_command_appends_blocks_and_is_idempotent(self) -> None:
        """Imported blocks follow existing content and are skipped on a repeat run."""
        Content.objects.create(
            page_id=self.page,
            display_order=7,
            content_type="paragraph",
            content_en="Existing content",
            content_ja="既存のコンテンツ",
        )

        first_output = self.run_command()
        second_output = self.run_command()

        # Tests: non-overwrite, display order, media upload, Japanese data, and rerun safety.
        # Expected output: two imported rows at orders 8 and 9, with no duplicate second run.
        imported_content = list(
            Content.objects.exclude(import_key=None).order_by("display_order")
        )
        self.assertIn("Created: 2", first_output)
        self.assertIn("already populated", second_output)
        self.assertEqual(Content.objects.count(), 3)
        self.assertEqual([content.display_order for content in imported_content], [8, 9])
        self.assertEqual(imported_content[0].content_ja, "ようこそ")
        self.assertIsNotNone(imported_content[1].media_asset)
        self.assertEqual(imported_content[1].image_alignment, "center")
        self.assertEqual(imported_content[1].image_width, 50)
        self.assertEqual(MediaAsset.objects.count(), 1)

    def test_rollback_removes_only_imported_content_and_media(self) -> None:
        """Rollback preserves manually entered rows while removing importer-owned records."""
        manual_content = Content.objects.create(
            page_id=self.page,
            display_order=1,
            content_type="paragraph",
            content_en="Manual content",
            content_ja="手動コンテンツ",
        )
        self.run_command()

        output = self.run_command("--rollback")

        # Tests: rollback ownership boundaries for both database and stored image records.
        # Expected output: the manual row remains and all imported rows and media are removed.
        self.assertIn("rollback complete", output)
        self.assertEqual(Content.objects.count(), 1)
        self.assertTrue(Content.objects.filter(pk=manual_content.pk).exists())
        self.assertEqual(MediaAsset.objects.count(), 0)

    def test_rollback_preserves_imported_media_reused_by_another_record(self) -> None:
        """Rollback keeps an imported file when another model references the asset."""
        self.run_command()
        media_asset = MediaAsset.objects.get()
        StaticImage.objects.create(
            display_name="Reused imported image",
            media_asset=media_asset,
        )

        self.run_command("--rollback")

        # Tests: an imported image can be reused without rollback breaking that new reference.
        # Expected output: imported Content is removed while the reused MediaAsset remains.
        self.assertEqual(Content.objects.count(), 0)
        self.assertTrue(MediaAsset.objects.filter(pk=media_asset.pk).exists())
