"""Validate the contents and resource usage of classified media uploads."""

import warnings
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from typing import BinaryIO

from django.conf import settings
from PIL import Image, UnidentifiedImageError

from .classification import MediaClassification


@dataclass(frozen=True)
class MediaValidation:
    """Content-validation results for one already-classified upload."""
    ## Pass basic upload, check for file

    is_valid: bool
    reasons: tuple[str, ...]
    size_bytes: int
    image_width: int | None = None
    image_height: int | None = None


@contextmanager
def _preserve_position(uploaded_file: BinaryIO) -> Iterator[None]:
    """Temporarily seek within an upload and restore its original position."""

    original_position = uploaded_file.tell()
    try:
        yield
    finally:
        uploaded_file.seek(original_position)


def _get_size(uploaded_file: BinaryIO) -> int:
    size = getattr(uploaded_file, "size", None)
    if isinstance(size, int) and size >= 0:
        return size

    with _preserve_position(uploaded_file):
        uploaded_file.seek(0, 2)
        return uploaded_file.tell()


def _validate_image(uploaded_file: BinaryIO) -> tuple[tuple[str, ...], int | None, int | None]:
    try:
        with _preserve_position(uploaded_file):
            uploaded_file.seek(0)
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(uploaded_file) as image:
                    width, height = image.size
                    max_pixels = settings.MEDIA_MAX_IMAGE_PIXELS
                    if width * height > max_pixels:
                        return ("image_dimensions_too_large",), width, height
                    image.verify()
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        return ("image_dimensions_too_large",), None, None
    except (OSError, UnidentifiedImageError, ValueError):
        return ("image_content_invalid",), None, None

    return (), width, height


def _validate_pdf(uploaded_file: BinaryIO, size_bytes: int) -> tuple[str, ...]:
    if size_bytes < 10:
        return ("pdf_content_invalid",)

    with _preserve_position(uploaded_file):
        uploaded_file.seek(0)
        header = uploaded_file.read(9)
        uploaded_file.seek(max(0, size_bytes - 1024))
        tail = uploaded_file.read(1024)

    if not header.startswith(b"%PDF-") or b"%%EOF" not in tail:
        return ("pdf_content_invalid",)
    return ()


def validate_media(
    uploaded_file: BinaryIO,
    classification: MediaClassification,
) -> MediaValidation:
    """Validate size and file contents after signature classification."""

    size_bytes = _get_size(uploaded_file)
    reasons: list[str] = []

    if size_bytes == 0:
        reasons.append("file_empty")
    if size_bytes > settings.MEDIA_MAX_UPLOAD_SIZE_BYTES:
        reasons.append("file_too_large")

    if not classification.is_valid:
        reasons.extend(classification.reasons)
    elif not reasons:
        if classification.detected_kind == "image":
            content_reasons, width, height = _validate_image(uploaded_file)
        elif classification.detected_kind == "pdf":
            content_reasons = _validate_pdf(uploaded_file, size_bytes)
            width = height = None
        else:
            content_reasons = ("unsupported_media_kind",)
            width = height = None
        reasons.extend(content_reasons)
    else:
        width = height = None

    return MediaValidation(
        is_valid=not reasons,
        reasons=tuple(reasons),
        size_bytes=size_bytes,
        image_width=width,
        image_height=height,
    )
