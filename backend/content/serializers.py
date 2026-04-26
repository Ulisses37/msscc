from rest_framework import serializers
from content.models import Content

class ContentSerializer(serializers.ModelSerializer):
    """Serializer for content records."""

    class Meta:
        model = Content
        fields = [
            "content_id",
            "page_id",
            "display_order",
            "content_type",
            "media_asset",
            "content_en",
            "content_ja",
        ]
