from django.urls import path

from .views import (
    MediaDetailView,
    MediaListView,
    MediaUploadView,
    StaticImageDetailView,
    StaticImageListView,
)

urlpatterns = [
    path("", MediaListView.as_view()),
    path("upload/", MediaUploadView.as_view()),
    path("static-images/", StaticImageListView.as_view(), name="static-image-list"),
    path(
        "static-images/<int:static_image_id>/",
        StaticImageDetailView.as_view(),
        name="static-image-detail",
    ),
    path("<int:pk>/", MediaDetailView.as_view()),
]
