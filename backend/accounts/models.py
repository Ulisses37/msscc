from django.contrib.auth.models import AbstractUser
from django.db import models


class AdminUser(AbstractUser):
    """Custom user model for MSSCC admin portal. Uses email as the login field."""

    username = None
    email = models.EmailField(unique=True)
    is_super_admin = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    class Meta:
        db_table = "admin_user"
        verbose_name = "Admin user"
        verbose_name_plural = "Admin users"

    def __str__(self):
        """Return the admin user's email."""
        return self.email
