from django.urls import include, path
from rest_framework.routers import DefaultRouter

from events.views import (
    AdminVolunteerSignupCreateView,
    EventDetailView,
    EventImageViewSet,
    EventListView,
    VolunteerCancellationLookupView,
    VolunteerSignupViewSet,
    VolunteerSlotViewSet,
)

router = DefaultRouter()
router.register(r"images", EventImageViewSet, basename="event-image")
router.register(r"slots", VolunteerSlotViewSet, basename="volunteer-slot")
router.register(r"signups", VolunteerSignupViewSet, basename="volunteer-signup")

urlpatterns = [
    path(
        "admin/signups/",
        AdminVolunteerSignupCreateView.as_view(),
        name="admin-volunteer-signup-create",
    ),
    path(
        "signups/cancel/<uuid:token>/",
        VolunteerCancellationLookupView.as_view(),
        name="volunteer-cancellation-lookup",
    ),
    path("", EventListView.as_view(), name="event-list"),
    path("<int:event_id>/", EventDetailView.as_view(), name="event-detail"),
    path("", include(router.urls)),
]
