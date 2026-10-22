from rest_framework.permissions import BasePermission


class HasFinancialRecordPermission(BasePermission):
    """Restrict financial records to executives and explicitly authorized admins."""

    message = "You do not have permission to access financial records."

    def has_permission(self, request, view):
        """Use the authenticated account rather than potentially stale JWT claims."""
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        if user.is_executive:
            return True
        permissions = user.permissions_data
        return isinstance(permissions, dict) and permissions.get("Finances") is True
