from django.urls import path

from accounts.views import get_admin, list_admins, update_permissions, create_admin, delete_admin, update_admin

urlpatterns = [
    path("", list_admins),
    path("<int:admin_id>/", get_admin),
    path("<int:admin_id>/permissions/", update_permissions),
    path("create/", create_admin),
    path("delete/<int:admin_id>", delete_admin),
    path("update/<int:admin_id>", update_admin)
]
