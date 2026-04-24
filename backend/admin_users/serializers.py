from rest_framework import serializers
from .models import AdminUser

class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminUser
        fields = [
            "admin_user_id",
            "first_name",
            "last_name",
            "email",
            "is_executive",
            "permissions",
        ]
