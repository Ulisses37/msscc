# backend/static_images/serializers.py
from rest_framework import serializers
from .models import static_image

# serializer allows for easier access to static image metadata
class StaticImageSerializer(serializers.ModelSerializer):
    """Serializer for static image records."""

    class Meta:
        model = static_image
        fields = [
            "static_image_id",
            "label",
            "media_asset",
        ]
