from django.urls import path
from content.views import get_content, get_content_for_page, update_content

urlpatterns = [
    path("content/get/<int:content_id>/", get_content, name="get_content"),
    path("content/update/<int:content_id>/", update_content, name="update_content"),
    path("content/page/<int:page_id>/", get_content_for_page, name="get_content_for_page"),
]
