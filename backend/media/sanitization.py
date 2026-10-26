"""Convert validated media into storage-ready, normalized representations."""

import os
import re
from dataclasses import dataclass
from io import BytesIO
from typing import BinaryIO

from django.conf import settings
from django.core.files.base import ContentFile, File
from PIL import Image, ImageOps

from .classification import MediaClassification


class MediaSanitizationError(Exception):
    """Raised when a validated upload cannot be converted safely."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class SanitizedMedia:
    """The file and canonical metadata to persist for an uploaded asset."""

    file: File
    file_name: str
    file_type: str
    converted: bool


def _safe_base_name(file_name: str, output_extension: str) -> str:
    name, _ = os.path.splitext(file_name)
    safe_name = re.sub(r"[^a-zA-Z0-9_-]", "_", name)
    max_base_length = max(
        1,
        settings.MEDIA_MAX_FILENAME_LENGTH - len(output_extension),
    )
    return (safe_name or "upload")[:max_base_length]


def _image_output_metadata(classification: MediaClassification) -> tuple[str, str, str]:
    if classification.detected_format == "jpeg":
        if classification.supplied_extension == ".jfif":
            return "WEBP", ".webp", "image/webp"
        extension = classification.supplied_extension or ".jpg"
        return "JPEG", extension, "image/jpeg"
    if classification.detected_format == "png":
        return "PNG", ".png", "image/png"
    if classification.detected_format == "webp":
        return "WEBP", ".webp", "image/webp"
    if classification.detected_format in {"bmp", "gif", "tiff"}:
        return "WEBP", ".webp", "image/webp"
    raise MediaSanitizationError("unsupported_image_format")


def _sanitize_image(
    uploaded_file: BinaryIO,
    file_name: str,
    classification: MediaClassification,
) -> SanitizedMedia:
    output_format, output_extension, output_mime_type = _image_output_metadata(classification)
    try:
        uploaded_file.seek(0)

        #Resave: Cleans meta data
        with Image.open(uploaded_file) as image:

            #Load first frame/image of Tiff and Gif
            if getattr(image, "n_frames", 1) > 1:
                image.seek(0)

            oriented_image = ImageOps.exif_transpose(image)
            max_dimension = settings.MEDIA_MAX_IMAGE_DIMENSION
            if max(oriented_image.size) > max_dimension:
                oriented_image.thumbnail(
                    (max_dimension, max_dimension),
                    Image.Resampling.LANCZOS,
                )

            has_alpha = "A" in oriented_image.getbands() or (
                oriented_image.mode == "P" and "transparency" in oriented_image.info
            )
            clean_image = oriented_image.convert("RGBA" if has_alpha else "RGB")

            output = BytesIO()
            if output_format == "JPEG":
                clean_image = clean_image.convert("RGB")
                clean_image.save(
                    output,
                    format=output_format,
                    quality=settings.MEDIA_JPEG_QUALITY,
                    optimize=True,
                    progressive=True,
                )
            elif output_format == "PNG":
                clean_image.save(
                    output,
                    format=output_format,
                    optimize=True,
                    compress_level=settings.MEDIA_PNG_COMPRESSION_LEVEL,
                )
            else:
                clean_image.save(
                    output,
                    format=output_format,
                    quality=settings.MEDIA_WEBP_QUALITY,
                    method=settings.MEDIA_WEBP_METHOD,
                )
    except (OSError, ValueError) as exc:
        raise MediaSanitizationError("image_conversion_failed") from exc
    finally:
        uploaded_file.seek(0)

    output_name = f"{_safe_base_name(file_name, output_extension)}{output_extension}"
    return SanitizedMedia(
        file=ContentFile(output.getvalue(), name=output_name),
        file_name=output_name,
        file_type=output_mime_type,
        converted=True,
    )

#Filter Image vs PDF
def sanitize_media(
    uploaded_file: BinaryIO,
    classification: MediaClassification,
) -> SanitizedMedia:
    """Normalize a validated upload before it is saved to storage."""

    file_name = str(getattr(uploaded_file, "name", "") or "")
    base_name = _safe_base_name(file_name, ".pdf")

    if classification.detected_kind == "image":
        return _sanitize_image(uploaded_file, file_name, classification)

    if classification.detected_kind == "pdf":
        output_name = f"{base_name}.pdf"
        uploaded_file.seek(0)
        uploaded_file.name = output_name
        return SanitizedMedia(
            file=uploaded_file,
            file_name=output_name,
            file_type="application/pdf",
            converted=False,
        )

    raise MediaSanitizationError("unsupported_media_kind")
