from rest_framework import generics

from static_image.models import StaticImage
from static_image.serializers import StaticImageSerializer


class StaticImageListView(generics.ListAPIView):
    """Return static image records as a JSON list."""

    queryset = StaticImage.objects.all().order_by("static_image_id")
    serializer_class = StaticImageSerializer


class StaticImageDetailView(generics.RetrieveUpdateAPIView):
    """Retrieve or update a single static image."""

    queryset = StaticImage.objects.all()
    serializer_class = StaticImageSerializer
    lookup_field = "static_image_id"
