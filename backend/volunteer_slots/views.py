from rest_framework import viewsets
from .models import VolunteerSlot
from .serializers import VolunteerSlotSerializer

class VolunteerSlotViewSet(viewsets.ModelViewSet):
    queryset = VolunteerSlot.objects.all()
    serializer_class = VolunteerSlotSerializer