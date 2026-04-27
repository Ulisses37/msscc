from rest_framework import viewsets
from .models import VolunteerSignup
from .serializers import VolunteerSignupSerializer

class VolunteerSignupViewSet(viewsets.ModelViewSet):
    queryset = VolunteerSignup.objects.all()
    serializer_class = VolunteerSignupSerializer