from django.db import models

class Page(models.Model):
    """Model representing a page on the MSSCC website."""

    page_id = models.AutoField(primary_key=True)
    page_slug = models.SlugField(max_length=255, unique=True)
    page_title = models.CharField(max_length=255)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["page_id"]
        db_table = "pages"
        verbose_name = "Page"
        verbose_name_plural = "Pages"

    def __str__(self):
        """Return a string representation of the page."""
        return f"Page {self.page_id}: {self.page_title}"
