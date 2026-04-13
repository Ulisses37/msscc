# backend/media/serializers.py
from rest_framework import serializers
from .models import FileModel

#Serial allows for ease of access to the file's metadata and URL in the API responses.
class MediaFileSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = FileModel
        fields = ["id", "file_name", "url", "uploaded_at"]

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
