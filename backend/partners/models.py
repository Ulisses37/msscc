from django.db import models


class Partner(models.Model):
    """Partner record for organizations shown on the site."""

    partner_id = models.AutoField(primary_key=True)
    display_name = models.TextField()
    category = models.TextField()
    website_url = models.URLField(blank=True, null=True)
    contribution_amount = models.DecimalField(max_digits=10, decimal_places=2)
    is_visible = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    media_asset_id = models.PositiveIntegerField(blank=True, null=True)

    class Meta:
        db_table = "partner"
        ordering = ["display_order", "partner_id"]
        verbose_name = "Partner"
        verbose_name_plural = "Partners"

    def __str__(self):
        """Return the partner display name."""
        return self.display_name
