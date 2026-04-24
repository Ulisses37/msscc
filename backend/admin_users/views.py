from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import AdminUser
from .serializers import AdminUserSerializer

@api_view(["GET"])
def list_admins(request):
    """Get all admin users"""
    admins = AdminUser.objects.all()
    serializer = AdminUserSerializer(admins, many=True)
    return Response(serializer.data)

@api_view(["GET"])
def get_admin(request, admin_user_id):
    """Get a single admin user"""
    admin = AdminUser.objects.get(pk=admin_user_id)
    serializer = AdminUserSerializer(admin)
    return Response(serializer.data)

@api_view(["PATCH"])
def update_permissions(request, admin_user_id):
    """Update permissions for an admin user"""
    admin = AdminUser.objects.get(pk=admin_user_id)
    admin.permissions = request.data["permissions"]
    admin.save()
    return Response({"success": True})
