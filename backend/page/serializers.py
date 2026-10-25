from rest_framework import serializers

from content.serializers import ContentSerializer
from page.models import Page


class PageSerializer(serializers.ModelSerializer):
    content = ContentSerializer(many=True, read_only=True, source="content_set")

    class Meta:
        model = Page
        fields = [
            "page_id",
            "page_slug",
            "page_title_en",
            "page_title_ja",
            "created_at",
            "updated_at",
            "content",
        ]
