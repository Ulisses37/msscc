from django.urls import path

from admin_users.views import AdminUserListView
urlpatterns = [
    path("", AdminUserListView.as_view(), name="admin-user-list"),
]
