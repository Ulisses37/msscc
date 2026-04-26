from django.db import models


class StaticImage(models.Model):
    """Stores metadata for a static image."""

    static_image_id = models.AutoField(primary_key=True)
    display_name = models.TextField()
    media_asset = models.ForeignKey(
        "media.MediaAsset",
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
        """Return the static image label."""
        return self.display_name
