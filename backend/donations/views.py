import logging

from django.db import DatabaseError
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from donations.models import AdminTableRevision, Donation, Membership
from donations.serializers import DonationSerializer, MembershipSerializer

logger = logging.getLogger(__name__)


class AdminTableRevisionView(APIView):
    """Return revision values used to refresh authenticated admin tables."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Return both table revisions without exposing admin table records."""
        try:
            revisions = dict(
                AdminTableRevision.objects.filter(
                    table_name__in=AdminTableRevision.TableName.values
                ).values_list("table_name", "revision")
            )
        except DatabaseError:
            logger.error("Database error while retrieving admin table revisions.")
            return Response(
                {"detail": "Table revisions are temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        expected_table_names = set(AdminTableRevision.TableName.values)
        if set(revisions) != expected_table_names:
            logger.error("Admin table revision records are missing or unsupported.")
            return Response(
                {"detail": "Table revisions are temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(revisions)


class DonationListCreateView(generics.ListCreateAPIView):
    """List donation records or create a new donation."""

    serializer_class = DonationSerializer

    def create(self, request, *args, **kwargs):
        """Create a donation without exposing database failure details."""
        try:
            return super().create(request, *args, **kwargs)
        except DatabaseError:
            logger.error("Database error while creating a donation.")
            return Response(
                {"detail": "Unable to save the donation at this time."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    # def get_permissions(self):
    #     """Allow public donations while protecting the donor list."""
    #     if self.request.method == "POST":
    #         return [permissions.AllowAny()]
    #     return [permissions.IsAdminUser()]

    def get_queryset(self):
        queryset = Donation.objects.all()

        donor_email = self.request.query_params.get("donor_email")
        payment_status = self.request.query_params.get("payment_status")
        reference_id = self.request.query_params.get("reference_id")

        if donor_email:
            queryset = queryset.filter(donor_email__iexact=donor_email)
        if payment_status:
            queryset = queryset.filter(payment_status__iexact=payment_status)
        if reference_id:
            queryset = queryset.filter(reference_id=reference_id)

        return queryset.order_by("-donation_date", "-created_at", "donation_id")


class DonationDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a single donation record."""

    queryset = Donation.objects.all()
    serializer_class = DonationSerializer
    lookup_field = "donation_id"
    permission_classes = [permissions.IsAdminUser]


class MembershipListCreateView(generics.ListCreateAPIView):
    """List membership records or create a new membership."""

    serializer_class = MembershipSerializer

    def get_queryset(self):
        queryset = Membership.objects.all()

        email = self.request.query_params.get("email")
        payment_status = self.request.query_params.get("payment_status")
        status = self.request.query_params.get("status")
        membership_type = self.request.query_params.get("membership_type")
        reference_id = self.request.query_params.get("reference_id")

        if email:
            queryset = queryset.filter(email__iexact=email)
        if payment_status:
            queryset = queryset.filter(payment_status__iexact=payment_status)
        if status:
            queryset = queryset.filter(status__iexact=status)
        if membership_type:
            queryset = queryset.filter(membership_type__iexact=membership_type)
        if reference_id:
            queryset = queryset.filter(reference_id=reference_id)

        return queryset.order_by("-start_date", "-created_at", "membership_id")


class MembershipDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a single membership record."""

    queryset = Membership.objects.all()
    serializer_class = MembershipSerializer
    lookup_field = "membership_id"
