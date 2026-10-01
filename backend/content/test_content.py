from django.test import TestCase

from content.models import Content
from content.serializers import ContentSerializer


class TestContentImageAlignment(TestCase):
    """Test image alignment defaults and serializer persistence."""

    def test_content_defaults_to_left_image_alignment(self) -> None:
        """New content defaults to left image alignment."""
        content = Content.objects.create(content_type="image")

        self.assertEqual(content.image_alignment, "left")

    def test_serializer_updates_image_alignment(self) -> None:
        """The content serializer persists a supported image alignment."""
        content = Content.objects.create(content_type="image")
        serializer = ContentSerializer(
            content,
            data={"image_alignment": "right"},
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        content.refresh_from_db()

        self.assertEqual(content.image_alignment, "right")

    def test_serializer_rejects_unsupported_image_alignment(self) -> None:
        """The content serializer rejects unsupported image alignment values."""
        content = Content.objects.create(content_type="image")
        serializer = ContentSerializer(
            content,
            data={"image_alignment": "top"},
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("image_alignment", serializer.errors)
