from django.urls import path

from accounts.views import get_admin, list_admins, update_permissions, create_admin

urlpatterns = [
    path("", list_admins),
    path("<int:admin_id>/", get_admin),
    path("<int:admin_id>/permissions/", update_permissions),
    path("create/", create_admin),
]
