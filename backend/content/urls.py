from django.urls import path
from content.views import get_content, get_content_for_page, update_content

urlpatterns = [
    path("get/<int:content_id>/", get_content, name="get_content"),
    path("update/<int:content_id>/", update_content, name="update_content"),
    path("page/<int:page_id>/", get_content_for_page, name="get_content_for_page"),
]
