from django.db import models

def default_permissions():
        """Return the default permissions for a new admin user."""
        return {
            "Events Manipulation": False,
            "Send Emails": False,
            "View Member Records": False,
            "Page Edit": False,
            "Translation Edit": False,
        }

class AdminUser(models.Model):
    """Admin User record for managing admin users and permissions"""

    admin_user_id = models.AutoField(primary_key=True)
    first_name = models.TextField()
    last_name = models.TextField()
    email = models.EmailField(unique=True)
    password_hash = models.TextField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_login = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)


    is_executive = models.BooleanField(default=False)
    permissions = models.JSONField(default=default_permissions)


    class Meta:
        ordering = ["is_executive", "created_at", "last_name", "first_name"]
        db_table = "admin_user"
        verbose_name = "Admin User"
        verbose_name_plural = "Admin Users"

    def __str__(self):
        """Return the admin user display name."""
        return f"{self.first_name} {self.last_name}"


