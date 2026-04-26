from rest_framework import viewsets
from .models import AdminUser
from .serializers import AdminUserSerializer

class AdminViewSet(viewsets.ModelViewSet):
    queryset = AdminUser.objects.all()
    serializer_class = AdminUserSerializer