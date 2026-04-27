from rest_framework import serializers
from .models import VolunteerSlot

class VolunteerSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = VolunteerSlot
        fields = '__all__'