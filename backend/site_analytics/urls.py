from django.urls import path

from . import views

urlpatterns = [
    path("", views.track_visit),
    path("summary/", views.visit_summary),
    path("<int:year>/", views.yearly_stats),
]
