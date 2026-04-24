from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models

class AdminUserManager(BaseUserManager):
    """Custom manager for AdminUser using email as the unique identifier."""

    def create_user(self, email, password=None, **extra_fields):
        """Create and return a regular user with an email and password."""
        if not email:
            raise ValueError("Email is required.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """Create and return a superuser with an email and password."""
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_executive", True)
        return self.create_user(email, password, **extra_fields)

def default_permissions():
    """Return the default permissions for a new admin user."""
    return {
        "Events Manipulation": False,
        "Send Emails": False,
        "View Member Records": False,
        "Page Edit": False,
        "Translation Edit": False,
    }


class AdminUser(AbstractUser):
    """Custom user model for MSSCC admin portal. Uses email as the login field."""

    objects = AdminUserManager()
    username = None
    email = models.EmailField(unique=True)
    is_executive = models.BooleanField(default=False)
    permissions_data = models.JSONField(default=default_permissions)
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
