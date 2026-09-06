from django.db import models


class MediaAsset(models.Model):
    """Stores metadata and a storage reference for a media asset."""

    file_name = models.CharField(max_length=255)
    file = models.FileField(upload_to='public/')
    file_type = models.CharField(max_length=100)
    alt_text_en = models.CharField(max_length=255, blank=True)
    alt_text_ja = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "media_asset"

    def __str__(self):
        return self.file_name


class StaticImage(models.Model):
    """Stores metadata for a reusable static image slot."""

    static_image_id = models.AutoField(primary_key=True)
    display_name = models.TextField()
    media_asset = models.ForeignKey(
        MediaAsset,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
    )

    class Meta:
        ordering = ["static_image_id"]
        db_table = "static_image"
        verbose_name = "Static Image"
        verbose_name_plural = "Static Images"

    def __str__(self):
        return self.display_name
