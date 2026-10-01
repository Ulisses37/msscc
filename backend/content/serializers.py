from rest_framework import serializers

from content.models import Content


class ContentSerializer(serializers.ModelSerializer):
    """Serializer for content records."""

    media_url = serializers.SerializerMethodField()

    def get_media_url(self, obj: Content) -> str | None:
        """Return the associated media asset URL for image previews."""
        if obj.media_asset and obj.media_asset.file:
            return obj.media_asset.file.url

        return None

    class Meta:
        model = Content
        fields = [
            "content_id",
            "page_id",
            "display_order",
            "content_type",
            "media_asset",
            "media_url",
            "content_en",
            "content_ja",
            "image_alignment",
            "image_width",
        ]
