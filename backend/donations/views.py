from rest_framework import generics

from donations.models import Donation, Membership
from donations.serializers import DonationSerializer, MembershipSerializer


class DonationListCreateView(generics.ListCreateAPIView):
    """List donation records or create a new donation."""

    serializer_class = DonationSerializer

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
