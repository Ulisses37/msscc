from content.models import Content
from content.serializers import ContentSerializer

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

@api_view(["GET"])
def get_content(request, content_id):
    """Return a single content record."""
    content = Content.objects.get(pk=content_id)
    serializer = ContentSerializer(content)
    return Response(serializer.data)

@api_view(["PATCH"])
def update_content(request, content_id):
    """Update a content record."""
    content = Content.objects.get(pk=content_id)
    serializer = ContentSerializer(content, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["GET"])
def get_content_for_page(request, page_id):
    """Return all content records for a given page, ordered by display_order."""
    content = Content.objects.filter(page_id=page_id).order_by("display_order")
    serializer = ContentSerializer(content, many=True)
    return Response(serializer.data)
