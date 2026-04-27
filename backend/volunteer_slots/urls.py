from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VolunteerSlotViewSet

router = DefaultRouter()
router.register(r'', VolunteerSlotViewSet)

urlpatterns = [
    path('', include(router.urls)),
]