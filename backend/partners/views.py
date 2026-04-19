from rest_framework import generics

from partners.models import Partner
from partners.serializers import PartnerSerializer


class PartnerListView(generics.ListAPIView):
    """Return partner records as a JSON list."""

    queryset = Partner.objects.all().order_by("display_order", "partner_id")
    serializer_class = PartnerSerializer
