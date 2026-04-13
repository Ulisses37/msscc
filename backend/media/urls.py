from django.urls import path

from .views import MediaDetailView, MediaListView, MediaUploadView

urlpatterns = [
    path("", MediaListView.as_view()),
    path("upload/", MediaUploadView.as_view()),
    path("<int:pk>/", MediaDetailView.as_view()),
]
