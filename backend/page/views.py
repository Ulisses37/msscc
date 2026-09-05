from page.models import Page
from page.serializers import PageSerializer

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status


@api_view(["GET"])
def get_all_pages(request):
    """Return all page records."""
    pages = Page.objects.all()
    serializer = PageSerializer(pages, many=True)
    return Response(serializer.data)


@api_view(["GET"])
def get_page(request, page_id):
    try:
        page = Page.objects.prefetch_related("content_set").get(pk=page_id)
    except Page.DoesNotExist:
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    serializer = PageSerializer(page)
    return Response(serializer.data)

@api_view(["GET"])
def get_page_by_slug(request, page_slug):
    """Return a page record by slug."""
    try:
        page = Page.objects.prefetch_related("content_set").get(page_slug=page_slug)
    except Page.DoesNotExist:
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    serializer = PageSerializer(page)
    return Response(serializer.data)
