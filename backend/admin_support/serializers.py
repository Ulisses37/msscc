from rest_framework import serializers
from .models import AdminSupport

class AdminSupportSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminSupport
        fields = '__all__'