from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VolunteerSignupViewSet

router = DefaultRouter()
router.register(r'', VolunteerSignupViewSet)

urlpatterns = [
    path('', include(router.urls)),
]