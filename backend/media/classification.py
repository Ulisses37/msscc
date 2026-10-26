"""Classify uploaded media using file signatures and upload metadata."""

import os
from dataclasses import dataclass
from typing import BinaryIO


@dataclass(frozen=True)
class SupportedMedia:
    """The canonical metadata for one supported media format."""

    format_name: str
    kind: str
    mime_type: str
    extension: str
    extensions: tuple[str, ...]
    signature_length: int
    accepted_mime_types: tuple[str, ...]

#Media extensions for classification, processing, or conversion
SUPPORTED_MEDIA = (
    SupportedMedia(
        format_name="jpeg",
        kind="image",
        mime_type="image/jpeg",
        extension=".jpg",
        extensions=(".jpg", ".jpeg", ".jfif"),
        signature_length=3,
        accepted_mime_types=("image/jpeg", "image/jfif"),
    ),
    SupportedMedia(
        format_name="png",
        kind="image",
        mime_type="image/png",
        extension=".png",
        extensions=(".png",),
        signature_length=8,
        accepted_mime_types=("image/png",),
    ),
    SupportedMedia(
        format_name="webp",
        kind="image",
        mime_type="image/webp",
        extension=".webp",
        extensions=(".webp",),
        signature_length=12,
        accepted_mime_types=("image/webp",),
    ),
    SupportedMedia(
        format_name="bmp",
        kind="image",
        mime_type="image/bmp",
        extension=".bmp",
        extensions=(".bmp",),
        signature_length=2,
        accepted_mime_types=("image/bmp",),
    ),
    SupportedMedia(
        format_name="tiff",
        kind="image",
        mime_type="image/tiff",
        extension=".tif",
        extensions=(".tif", ".tiff"),
        signature_length=4,
        accepted_mime_types=("image/tiff",),
    ),
    SupportedMedia(
        format_name="gif",
        kind="image",
        mime_type="image/gif",
        extension=".gif",
        extensions=(".gif",),
        signature_length=6,
        accepted_mime_types=("image/gif",),
    ),
    SupportedMedia(
        format_name="pdf",
        kind="pdf",
        mime_type="application/pdf",
        extension=".pdf",
        extensions=(".pdf",),
        signature_length=5,
        accepted_mime_types=("application/pdf",),
    ),
)


@dataclass(frozen=True)
class MediaClassification:
    """The detected media type and any metadata consistency failures."""

    detected_kind: str | None
    detected_format: str | None
    detected_mime_type: str | None
    detected_extension: str | None
    supplied_extension: str
    supplied_mime_type: str
    is_valid: bool
    reasons: tuple[str, ...]


def _read_signature(uploaded_file: BinaryIO, length: int) -> bytes:
    """Read from the beginning and restore the stream's original position."""

    original_position = uploaded_file.tell()
    try:
        uploaded_file.seek(0)
        return uploaded_file.read(length)
    finally:
        uploaded_file.seek(original_position)


def _matches_signature(data: bytes, media: SupportedMedia) -> bool:
    if media.format_name == "jpeg":
        return data.startswith(b"\xff\xd8\xff")
    if media.format_name == "png":
        return data == b"\x89PNG\r\n\x1a\n"
    if media.format_name == "webp":
        return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    if media.format_name == "bmp":
        return data.startswith(b"BM")
    if media.format_name == "tiff":
        return data in (b"II*\x00", b"MM\x00*")
    if media.format_name == "gif":
        return data in (b"GIF87a", b"GIF89a")
    if media.format_name == "pdf":
        return data.startswith(b"%PDF-")
    return False


def classify_media(uploaded_file: BinaryIO) -> MediaClassification:
    """Classify an uploaded file and require metadata to match its signature."""

    file_name = str(getattr(uploaded_file, "name", "") or "")
    supplied_extension = os.path.splitext(file_name)[1].lower()
    supplied_mime_type = str(getattr(uploaded_file, "content_type", "") or "").strip().lower()

    detected_media = None
    for media in SUPPORTED_MEDIA:
        signature = _read_signature(uploaded_file, media.signature_length)
        if _matches_signature(signature, media):
            detected_media = media
            break

    reasons: list[str] = []
    if detected_media is None:
        reasons.append("unrecognized_file_signature")
        return MediaClassification(
            detected_kind=None,
            detected_format=None,
            detected_mime_type=None,
            detected_extension=None,
            supplied_extension=supplied_extension,
            supplied_mime_type=supplied_mime_type,
            is_valid=False,
            reasons=tuple(reasons),
        )

    if not supplied_extension:
        reasons.append("missing_file_extension")
    elif supplied_extension not in detected_media.extensions:
        reasons.append("file_extension_mismatch")

    if not supplied_mime_type:
        reasons.append("missing_mime_type")
    elif supplied_mime_type not in detected_media.accepted_mime_types:
        reasons.append("mime_type_mismatch")

    return MediaClassification(
        detected_kind=detected_media.kind,
        detected_format=detected_media.format_name,
        detected_mime_type=detected_media.mime_type,
        detected_extension=detected_media.extension,
        supplied_extension=supplied_extension,
        supplied_mime_type=supplied_mime_type,
        is_valid=not reasons,
        reasons=tuple(reasons),
    )
