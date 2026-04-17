# backend/media/serializers.py
from rest_framework import serializers
from .models import MediaAsset

#Serial allows for ease of access to the file's metadata and URL in the API responses.
class MediaFileSerializer(serializers.ModelSerializer):
    media_asset_id = serializers.IntegerField(source="id", read_only=True)
    file_key = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = MediaAsset
        fields = [
            "media_asset_id",
            "file_key",
            "file_url",
            "file_name",
            "file_type",
            "alt_text",
            "created_at",
        ]
        read_only_fields = [
            "media_asset_id",
            "file_key",
            "file_url",
            "created_at"
        ]

    def get_url(self, obj):
        """
        obj.file.url generates a signed URL automatically.
        django-storages + boto3 handles the signing using
        the S3 credentials from settings.py. The URL points
        at msscc-storage.uahomeserver.net (dev) or R2 (prod)
        depending on S3_ENDPOINT_URL in .env.
        """
        if obj.file:
            return obj.file.url
        return None

    def get_file_key(self, obj):
        if obj.file:
            return obj.file.name
        return None

    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None
