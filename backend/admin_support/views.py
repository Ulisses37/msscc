from rest_framework import viewsets
from .models import AdminSupport
from .serializers import AdminSupportSerializer

class AdminSupportViewSet(viewsets.ModelViewSet):
    queryset = AdminSupport.objects.filter(is_deleted=False)
    serializer_class = AdminSupportSerializer