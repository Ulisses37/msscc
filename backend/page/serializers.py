from rest_framework import serializers
from page.models import Page
from content.serializers import ContentSerializer

class PageSerializer(serializers.ModelSerializer):
    content = ContentSerializer(many=True, read_only=True, source="content_set")

    class Meta:
        model = Page
        fields = [
            "page_id",
            "page_slug",
            "page_title",
            "created_at",
            "updated_at",
            "content",
        ]
