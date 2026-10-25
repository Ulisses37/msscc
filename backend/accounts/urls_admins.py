from django.urls import path

from accounts.views import (
    create_admin,
    delete_admin,
    get_admin,
    list_admins,
    set_executive,
    update_admin,
    update_permissions,
)

urlpatterns = [
    path("", list_admins),
    path("<int:admin_id>/", get_admin),
    path("<int:admin_id>/permissions/", update_permissions),
    path("create/", create_admin),
    path("delete/<int:admin_id>", delete_admin),
    path("update/<int:admin_id>", update_admin),
    path("promote-executive/<int:admin_id>",  set_executive),
]
