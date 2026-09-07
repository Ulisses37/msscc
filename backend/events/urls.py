from django.urls import include, path
from rest_framework.routers import DefaultRouter

from events.views import (
    EventDetailView,
    EventListView,
    VolunteerSignupViewSet,
    VolunteerSlotViewSet,
)

router = DefaultRouter()
router.register(r"slots", VolunteerSlotViewSet, basename="volunteer-slot")
router.register(r"signups", VolunteerSignupViewSet, basename="volunteer-signup")

urlpatterns = [
    path("", EventListView.as_view(), name="event-list"),
    path("<int:event_id>/", EventDetailView.as_view(), name="event-detail"),
    path("", include(router.urls)),
]
