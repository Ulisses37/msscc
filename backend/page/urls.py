from django.urls import path
from page.views import get_all_pages, get_page

urlpatterns = [
    path("get-all/", get_all_pages, name="get_all_pages"),
    path("get/<int:page_id>/", get_page, name="get_page"),
]
