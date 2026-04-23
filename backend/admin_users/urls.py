from django.urls import path
from admin_users import views

urlpatterns = [
    path("", views.list_admins),
    path("<int:admin_user_id>/", views.get_admin),
    path("<int:admin_user_id>/permissions/", views.update_permissions),
]
