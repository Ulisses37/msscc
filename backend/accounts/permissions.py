from rest_framework.permissions import BasePermission


class IsExecutiveAdmin(BasePermission):
    """Allow executive admins and superusers to manage admin accounts."""

    message = "Executive admin access is required."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_executive or user.is_superuser)
        )


class IsSuperuserAdmin(BasePermission):
    """Allow only superusers to change executive-admin status."""

    message = "Developer admin access is required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_superuser)
