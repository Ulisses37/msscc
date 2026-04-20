from django.db import models


class BoardMember(models.Model):
    """Board member record for people shown on the site."""

    board_member_id = models.AutoField(primary_key=True)
    display_name = models.TextField()
    display_order = models.PositiveIntegerField(default=0)
    external_link = models.URLField(blank=True, null=True)
    media_asset = models.ForeignKey(
        "media.MediaAsset",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
    )
    role = models.TextField()
    start_date = models.DateField()
    caption = models.TextField(blank=True)

    class Meta:
        ordering = ["display_order", "board_member_id"]
        db_table = "board_member"
        verbose_name = "Board Member"
        verbose_name_plural = "Board Members"

    def __str__(self):
        """Return the board member display name."""
        return self.display_name
