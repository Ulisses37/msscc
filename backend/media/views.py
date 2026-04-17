# backend/media/views.py
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import MediaAsset
from .serializers import MediaFileSerializer
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

@method_decorator(csrf_exempt, name='dispatch')

# Must Upload via parsing multipart/form-data, not JSON. The file goes to MinIO automatically via django-storages + boto3.
class MediaUploadView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        """
        Upload a file. The file goes to MinIO automatically —
        django-storages handles it via the S3 backend configured
        in settings.py. Django just sees a normal FileField.
        """
        file = request.FILES.get("image")
        if not file:
            return Response(
                {"error": "No file provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        import re
        import os

        name, ext = os.path.splitext(file.name)
        safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', name)

        file.name = f"{safe_name}{ext}"

        media = MediaAsset.objects.create(
            file=file,
            file_name=file.name,
            file_type=file.content_type or "",
            alt_text=request.data.get("alt_text", ""),
        )

        serializer = MediaFileSerializer(media)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

# The list and detail views return the file's metadata plus a signed URL. The frontend uses this URL in <img> tags — the browser fetches the image directly
# Basically Grabs URL references to the files in MinIO for security.
class MediaListView(APIView):
    def get(self, request):
        media_files = MediaAsset.objects.order_by("-created_at")
        serializer = MediaFileSerializer(media_files, many=True, context={"request": request})
        return Response(serializer.data)

#Must Delete from Reference given by URL,
#Using this, Model and Backend Storage Deletes without touching files in storage directly.
class MediaDetailView(APIView):

    def get(self, request, pk):
        """
        Return the file's metadata and a signed URL.
        The frontend uses this URL in <img> tags — the browser
        fetches the image directly from MinIO, not through Django.
        """
        try:
            media = MediaAsset.objects.get(pk=pk)
        except MediaAsset.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = MediaFileSerializer(media)
        return Response(serializer.data)

    def delete(self, request, pk):
        try:
            media = MediaAsset.objects.get(pk=pk)
        except MediaAsset.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        try:
            file_key = media.file.name
            storage = media.file.storage
            storage.delete(file_key)

        except Exception as e:
            return Response(
                {"error": f"Failed to delete file from storage: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        media.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
