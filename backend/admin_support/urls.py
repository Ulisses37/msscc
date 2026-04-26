# admin_support/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AdminSupportViewSet

router = DefaultRouter()
router.register(r'', AdminSupportViewSet, basename='admin_support')

urlpatterns = [
    path('', include(router.urls)),
]