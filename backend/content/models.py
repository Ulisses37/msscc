from django.db import models


# Restrict saved values so the editor and public renderer stay in sync.
IMAGE_ALIGNMENT_CHOICES = [
    ("left", "Left"),
    ("center", "Center"),
    ("right", "Right"),
]

# Restrict image sizing to the percentage options available in the editor.
IMAGE_WIDTH_CHOICES = [
    (25, "25%"),
    (50, "50%"),
    (75, "75%"),
    (100, "100%"),
]


class Content(models.Model):
    """Model representing content for the MSSCC website."""

    content_id = models.AutoField(primary_key=True)
    page_id = models.ForeignKey(
        "page.Page",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="page_id",
    )

    display_order = models.PositiveIntegerField(default=0)
    content_type = models.CharField(max_length=255)
    media_asset = models.ForeignKey(
        "media.MediaAsset",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
    )

    content_en = models.TextField(blank=True)
    content_ja = models.TextField(blank=True)
    # Left alignment preserves the layout used before alignment controls existed.
    image_alignment = models.CharField(
        max_length=6,
        choices=IMAGE_ALIGNMENT_CHOICES,
        default="left",
    )
    # Full width preserves the image size used before resize controls existed.
    image_width = models.PositiveSmallIntegerField(
        choices=IMAGE_WIDTH_CHOICES,
        default=100,
    )

    class Meta:
        ordering = ["page_id", "content_id"]
        db_table = "content"
        verbose_name = "Content"
        verbose_name_plural = "Content"

    def __str__(self) -> str:
        """Return a string representation of the content."""
        return f"Content {self.content_id} for Page {self.page_id}"
