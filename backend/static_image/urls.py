from django.urls import path

from .views import StaticImageListView, StaticImageDetailView

urlpatterns = [
    path("", StaticImageListView.as_view(), name="static-image-list"),
    path("<int:static_image_id>/", StaticImageDetailView.as_view(), name="static-image-detail"),
]
