# backend/static_images/serializers.py
from rest_framework import serializers
from .models import StaticImage

# serializer allows for easier access to static image metadata
class StaticImageSerializer(serializers.ModelSerializer):
    """Serializer for static image records."""

    class Meta:
        model = StaticImage
        fields = [
            "static_image_id",
            "label",
            "media_asset",
        ]
