from django.urls import path

from events.views import EventListView, EventDetailView

urlpatterns = [
    path("", EventListView.as_view(), name="event-list"),
    path("<int:event_id>/", EventDetailView.as_view(), name="event-detail"),
]
