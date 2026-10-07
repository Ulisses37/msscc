from django.db import models


class AdminSupport(models.Model):
    name = models.TextField()
    email = models.EmailField()
    subject = models.TextField()
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_deleted = models.BooleanField(default=False)

    def __str__(self) -> str:
        """Return the contact subject for display in the admin portal."""
        return self.subject
