# backend/media/views.py
from django.db import transaction
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import MediaAsset, StaticImage
from .serializers import MediaFileSerializer, StaticImageSerializer


#The file goes to MinIO automatically via django-storages + boto3.
@method_decorator(csrf_exempt, name='dispatch')
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

        import os
        import re

        name, ext = os.path.splitext(file.name)
        safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', name)

        file.name = f"{safe_name}{ext}"

        media = MediaAsset.objects.create(
            file=file,
            file_name=file.name,
            file_type=file.content_type or "",
            alt_text_en=request.data.get("alt_text_en", request.data.get("alt_text", "")),
            alt_text_ja=request.data.get("alt_text_ja", ""),
        )

        serializer = MediaFileSerializer(media)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# The list and detail views return the file's metadata plus a signed URL.
# The frontend uses this URL in <img> tags — the browser fetches the image directly
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

        if StaticImage.objects.filter(media_asset_id=media.pk).exists():
            return Response(
                {"error": "This media asset is linked to a static image and cannot be deleted."},
                status=status.HTTP_409_CONFLICT,
            )

        placeholder = StaticImage.objects.filter(static_image_id=0).first()
        replacement_id = placeholder.media_asset_id if placeholder else None
        if replacement_id == media.pk:
            replacement_id = None

        from board_members.models import BoardMember
        from content.models import Content
        from events.models import Event, EventImage
        from partners.models import Partner

        try:
            with transaction.atomic():
                replacement_count = 0
                for model in (Partner, BoardMember, Event, EventImage, Content):
                    updated = model.objects.filter(media_asset_id=media.pk).update(
                        media_asset_id=replacement_id,
                    )
                    replacement_count += updated

                file_key = media.file.name
                storage = media.file.storage
                storage.delete(file_key)
                media.delete()
        except Exception as e:
            return Response(
                {"error": f"Failed to delete file or update references: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "deleted_media_asset_id": media.pk,
                "replacement_media_asset_id": replacement_id,
                "updated_reference_count": replacement_count,
            },
            status=status.HTTP_200_OK,
        )


class StaticImageListView(generics.ListAPIView):
    """Return static image records as a JSON list."""

    queryset = StaticImage.objects.all().order_by("static_image_id")
    serializer_class = StaticImageSerializer


class StaticImageDetailView(generics.RetrieveUpdateAPIView):
    """Retrieve or update a single static image."""

    queryset = StaticImage.objects.all()
    serializer_class = StaticImageSerializer
    lookup_field = "static_image_id"
