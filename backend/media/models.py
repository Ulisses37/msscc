from django.db import models


class MediaAsset(models.Model):
    """Stores metadata and a storage reference for a media asset."""

    file_name = models.CharField(max_length=255)
    file = models.FileField(upload_to='public/')
    file_type = models.CharField(max_length=100)
    alt_text = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "media_asset"

    def __str__(self):
        return self.file_name
