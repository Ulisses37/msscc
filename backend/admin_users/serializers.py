from rest_framework import serializers
from .models import AdminUser

class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminUser
        fields = '__all__'