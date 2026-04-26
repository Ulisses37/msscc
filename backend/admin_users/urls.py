from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AdminViewSet # Adjust if your ViewSet has a different name

router = DefaultRouter()
router.register(r'', AdminViewSet, basename='admin_users')

urlpatterns = [
    path('', include(router.urls)),
]