from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from accounts.models import AdminUser


@admin.register(AdminUser)
class AdminUserAdmin(UserAdmin):
    """Admin panel configuration for AdminUser."""

    ordering = ["email"]
    list_display = ["email", "first_name", "last_name", "is_executive", "is_active"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_executive", "groups", "user_permissions")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "first_name", "last_name", "password1", "password2"),
        }),
    )
