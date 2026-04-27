from rest_framework import serializers
from .models import VolunteerSignup

class VolunteerSignupSerializer(serializers.ModelSerializer):
    class Meta:
        model = VolunteerSignup
        fields = '__all__'