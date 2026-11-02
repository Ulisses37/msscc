import mimetypes
import zipfile
from dataclasses import dataclass, replace
from html import escape
from pathlib import Path
from xml.etree import ElementTree

WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
DRAWING_NAMESPACE = "http://schemas.openxmlformats.org/drawingml/2006/main"
RELATIONSHIP_NAMESPACE = (
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
)
PACKAGE_RELATIONSHIP_NAMESPACE = (
    "http://schemas.openxmlformats.org/package/2006/relationships"
)
VML_NAMESPACE = "urn:schemas-microsoft-com:vml"

NAMESPACES = {
    "a": DRAWING_NAMESPACE,
    "r": RELATIONSHIP_NAMESPACE,
    "v": VML_NAMESPACE,
    "w": WORD_NAMESPACE,
}

PAGE_HEADINGS = {
    "Home": "home",
    "About | Board": "about",
    "Membership": "membership",
    "Support": "support",
    "Programs | Events": "events",
    "Partners": "partners",
}

BLOCK_PREFIXES = {
    "Header:": "header",
    "Subheader:": "subheader",
    "Paragraph:": "paragraph",
}


class PageContentDocumentError(Exception):
    """Raised when the page-content document cannot be parsed safely."""


@dataclass(frozen=True)
class ParsedContentBlock:
    """One page-editor block parsed from the source DOCX file."""

    page_slug: str
    content_type: str
    content_en: str
    import_key: str = ""
    image_name: str | None = None
    image_bytes: bytes | None = None
    image_content_type: str | None = None


def _paragraph_text(paragraph: ElementTree.Element) -> str:
    return "".join(
        node.text or "" for node in paragraph.findall(".//w:t", NAMESPACES)
    ).strip()


def _run_is_bold(run: ElementTree.Element) -> bool:
    bold = run.find("w:rPr/w:b", NAMESPACES)
    if bold is None:
        return False

    value = bold.attrib.get(f"{{{WORD_NAMESPACE}}}val", "true").lower()
    return value not in {"0", "false", "off", "none"}


def _formatted_paragraph_text(
    paragraph: ElementTree.Element,
    *,
    skip_characters: int = 0,
) -> str:
    """Return safe rich text while preserving supported Word run formatting."""
    formatted_runs = []
    remaining_skip = skip_characters

    for run in paragraph.findall(".//w:r", NAMESPACES):
        run_text = "".join(
            node.text or "" for node in run.findall(".//w:t", NAMESPACES)
        )
        if not run_text:
            continue

        if remaining_skip:
            skipped_count = min(remaining_skip, len(run_text))
            run_text = run_text[skipped_count:]
            remaining_skip -= skipped_count
        if not run_text:
            continue

        safe_text = escape(run_text, quote=False)
        if _run_is_bold(run):
            safe_text = f"<strong>{safe_text}</strong>"
        formatted_runs.append(safe_text)

    return "".join(formatted_runs).strip()


def _is_list_paragraph(paragraph: ElementTree.Element) -> bool:
    return paragraph.find("w:pPr/w:numPr", NAMESPACES) is not None


def _relationship_targets(archive: zipfile.ZipFile) -> dict[str, str]:
    root = ElementTree.fromstring(
        archive.read("word/_rels/document.xml.rels")
    )
    relationship_tag = f"{{{PACKAGE_RELATIONSHIP_NAMESPACE}}}Relationship"
    return {
        relationship.attrib["Id"]: relationship.attrib["Target"]
        for relationship in root.findall(relationship_tag)
    }


def _image_relationship_ids(paragraph: ElementTree.Element) -> list[str]:
    relationship_ids = [
        image.attrib[f"{{{RELATIONSHIP_NAMESPACE}}}embed"]
        for image in paragraph.findall(".//a:blip", NAMESPACES)
    ]
    relationship_ids.extend(
        image.attrib[f"{{{RELATIONSHIP_NAMESPACE}}}id"]
        for image in paragraph.findall(".//v:imagedata", NAMESPACES)
    )
    return relationship_ids


def _read_image(
    archive: zipfile.ZipFile,
    relationship_targets: dict[str, str],
    relationship_id: str,
) -> tuple[str, bytes, str]:
    target = relationship_targets.get(relationship_id)
    if not target or not target.startswith("media/"):
        raise PageContentDocumentError(
            f"Image relationship {relationship_id} does not point to embedded media."
        )

    archive_path = f"word/{target}"
    image_name = Path(target).name
    image_content_type = mimetypes.guess_type(image_name)[0]
    if not image_content_type or not image_content_type.startswith("image/"):
        raise PageContentDocumentError(
            f"Embedded media {image_name} is not a supported image filename."
        )

    return image_name, archive.read(archive_path), image_content_type


def _append_text_block(
    blocks: list[ParsedContentBlock],
    page_slug: str | None,
    content_type: str,
    paragraphs: list[str],
) -> None:
    if not page_slug:
        raise PageContentDocumentError("Content appears before a recognized page heading.")
    if not paragraphs:
        raise PageContentDocumentError(f"The {content_type} block has no content.")

    blocks.append(
        ParsedContentBlock(
            page_slug=page_slug,
            content_type=content_type,
            content_en="\n\n".join(paragraphs),
        )
    )


def _assign_import_keys(blocks: list[ParsedContentBlock]) -> list[ParsedContentBlock]:
    page_counts: dict[str, int] = {}
    keyed_blocks = []

    for block in blocks:
        page_counts[block.page_slug] = page_counts.get(block.page_slug, 0) + 1
        import_key = (
            f"scrum-845:pagecontent:{block.page_slug}:"
            f"{page_counts[block.page_slug]:03d}"
        )
        keyed_blocks.append(replace(block, import_key=import_key))

    return keyed_blocks


def parse_page_content_document(document_path: Path) -> list[ParsedContentBlock]:
    """Parse page-editor blocks and embedded images from the source DOCX file."""
    if not document_path.is_file():
        raise PageContentDocumentError(f"Document not found: {document_path}")

    blocks: list[ParsedContentBlock] = []
    current_page: str | None = None
    current_text_type: str | None = None
    current_paragraphs: list[str] = []
    waiting_for_image = False
    pending_image_index: int | None = None

    def flush_text_block() -> None:
        nonlocal current_text_type, current_paragraphs
        if current_text_type:
            _append_text_block(
                blocks,
                current_page,
                current_text_type,
                current_paragraphs,
            )
        current_text_type = None
        current_paragraphs = []

    try:
        with zipfile.ZipFile(document_path) as archive:
            document = ElementTree.fromstring(archive.read("word/document.xml"))
            relationship_targets = _relationship_targets(archive)
            body = document.find("w:body", NAMESPACES)
            if body is None:
                raise PageContentDocumentError("The DOCX file has no document body.")

            for paragraph in body.findall("w:p", NAMESPACES):
                text = _paragraph_text(paragraph)
                formatted_text = _formatted_paragraph_text(paragraph)
                image_ids = _image_relationship_ids(paragraph)

                if image_ids:
                    if not waiting_for_image or not current_page:
                        raise PageContentDocumentError(
                            "Each embedded image must immediately follow an Image: marker."
                        )
                    if len(image_ids) != 1:
                        raise PageContentDocumentError(
                            "Each Image: block must contain exactly one embedded image."
                        )

                    image_name, image_bytes, image_content_type = _read_image(
                        archive,
                        relationship_targets,
                        image_ids[0],
                    )
                    blocks.append(
                        ParsedContentBlock(
                            page_slug=current_page,
                            content_type="image",
                            content_en="",
                            image_name=image_name,
                            image_bytes=image_bytes,
                            image_content_type=image_content_type,
                        )
                    )
                    pending_image_index = len(blocks) - 1
                    waiting_for_image = False
                    continue

                if not text:
                    continue

                if text in PAGE_HEADINGS:
                    flush_text_block()
                    if waiting_for_image:
                        raise PageContentDocumentError(
                            "An Image: marker is missing its embedded image."
                        )
                    current_page = PAGE_HEADINGS[text]
                    pending_image_index = None
                    continue

                if text == "Image:":
                    flush_text_block()
                    if not current_page:
                        raise PageContentDocumentError(
                            "An Image: marker appears before a page heading."
                        )
                    waiting_for_image = True
                    pending_image_index = None
                    continue

                if text.startswith("Caption:"):
                    if pending_image_index is None:
                        raise PageContentDocumentError(
                            "A Caption: marker must immediately follow an image."
                        )
                    caption = _formatted_paragraph_text(
                        paragraph,
                        skip_characters=len("Caption:"),
                    )
                    blocks[pending_image_index] = replace(
                        blocks[pending_image_index],
                        content_en=caption,
                    )
                    pending_image_index = None
                    continue

                matched_prefix = next(
                    (prefix for prefix in BLOCK_PREFIXES if text.startswith(prefix)),
                    None,
                )
                if matched_prefix:
                    flush_text_block()
                    current_text_type = BLOCK_PREFIXES[matched_prefix]
                    first_paragraph = _formatted_paragraph_text(
                        paragraph,
                        skip_characters=len(matched_prefix),
                    )
                    if not first_paragraph:
                        raise PageContentDocumentError(
                            f"The {matched_prefix} marker has no content."
                        )
                    current_paragraphs = [first_paragraph]
                    pending_image_index = None
                    continue

                # Unlabeled paragraphs continue the active paragraph block. After an
                # image, they begin a new paragraph block on the same page.
                paragraph_content = (
                    f"* {formatted_text}" if _is_list_paragraph(paragraph) else formatted_text
                )
                if current_text_type == "paragraph":
                    current_paragraphs.append(paragraph_content)
                elif current_text_type:
                    raise PageContentDocumentError(
                        "Only Paragraph: blocks may contain unlabeled continuation text."
                    )
                else:
                    current_text_type = "paragraph"
                    current_paragraphs = [paragraph_content]
                pending_image_index = None

            flush_text_block()
            if waiting_for_image:
                raise PageContentDocumentError(
                    "The final Image: marker is missing its embedded image."
                )
    except (KeyError, zipfile.BadZipFile, ElementTree.ParseError) as exc:
        raise PageContentDocumentError(
            "The page-content document is not a readable DOCX file."
        ) from exc

    return _assign_import_keys(blocks)
