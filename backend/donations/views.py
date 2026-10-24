import logging
from decimal import Decimal

from django.core.exceptions import ImproperlyConfigured
from django.db import DatabaseError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from config.encryption import EncryptedTextError
from donations.models import AdminTableRevision, Donation, Membership
from donations.permissions import HasFinancialRecordPermission
from donations.processing_costs import calculate_donation_amounts
from donations.search import DONATION_SEARCH_FIELDS, MEMBERSHIP_SEARCH_FIELDS, search_encrypted_pii
from donations.serializers import (
    DonationSerializer,
    MembershipSerializer,
    StrictContributionChoiceField,
)

logger = logging.getLogger(__name__)


class DonationQuoteSerializer(serializers.Serializer):
    """Accept only pricing inputs; supplied totals must not shape a public quote."""

    amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=Decimal("0.01")
    )
    contribute_to_processing_costs = StrictContributionChoiceField(default=False)

    def to_internal_value(self, data):
        if not isinstance(data, dict) or set(data) - set(self.fields):
            raise serializers.ValidationError({"detail": "Unsupported quote information."})
        return super().to_internal_value(data)

    def validate(self, attrs):
        # Match donation creation's field limits before the donor enters
        # payment details, including cases where gross-up exceeds the DB limit.
        try:
            calculate_donation_amounts(attrs["amount"], attrs["contribute_to_processing_costs"])
        except ValueError as exc:
            raise serializers.ValidationError({"amount": str(exc)}) from None
        return attrs


class DonationQuoteView(APIView):
    """Preview the same server calculation used at donation creation."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        # No record or Stripe session is created here: changing the checkbox
        # can refresh the displayed price before the payer commits to checkout.
        serializer = DonationQuoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        base = serializer.validated_data["amount"]
        contribution, total = calculate_donation_amounts(
            base, serializer.validated_data["contribute_to_processing_costs"]
        )
        return Response({
            "amount": f"{base:.2f}",
            "processing_cost_contribution": f"{contribution:.2f}",
            "total_amount": f"{total:.2f}",
        })


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


class EncryptedPIIResponseMixin:
    """Contain encryption failures before DRF or Django can log sensitive exceptions."""

    def get_object(self):
        """Do not let DRF turn an encrypted-field ValueError into a misleading 404."""
        queryset = self.filter_queryset(self.get_queryset())
        lookup = self.lookup_url_kwarg or self.lookup_field
        obj = get_object_or_404(queryset, **{self.lookup_field: self.kwargs[lookup]})
        self.check_object_permissions(self.request, obj)
        return obj

    def perform_create(self, serializer):
        """Roll back any failed encrypted write before handling the error."""
        with transaction.atomic():
            serializer.save()

    def perform_update(self, serializer):
        """Keep PII and non-PII updates together if field encryption fails."""
        with transaction.atomic():
            serializer.save()

    def handle_exception(self, exc):
        """Return a fixed error without attaching exception text or traceback to logs."""
        if isinstance(exc, (EncryptedTextError, ImproperlyConfigured)):
            logger.error("Encrypted record processing is temporarily unavailable.")
            return Response(
                {"detail": "Record processing is temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return super().handle_exception(exc)


def filter_encrypted_email(queryset, field_name, email):
    """Preserve exact email lookup without querying randomized ciphertext."""
    expected = email.casefold()
    matches = [
        record.pk
        for record in queryset.only("pk", field_name).iterator()
        if (getattr(record, field_name) or "").casefold() == expected
    ]
    return queryset.filter(pk__in=matches)


class DonationListCreateView(EncryptedPIIResponseMixin, generics.ListCreateAPIView):
    """List donation records or create a new donation."""

    serializer_class = DonationSerializer
    permission_classes = [HasFinancialRecordPermission]

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

    def get_permissions(self):
        """Allow public creation while restricting donor records to admins."""
        if self.request.method == "POST":
            return [permissions.AllowAny()]
        return super().get_permissions()

    def get_queryset(self):
        queryset = Donation.objects.all()

        donor_email = self.request.query_params.get("donor_email")
        payment_status = self.request.query_params.get("payment_status")
        reference_id = self.request.query_params.get("reference_id")

        if payment_status:
            queryset = queryset.filter(payment_status__iexact=payment_status)
        if reference_id:
            queryset = queryset.filter(reference_id=reference_id)
        if donor_email:
            queryset = filter_encrypted_email(queryset, "donor_email_encrypted", donor_email)

        queryset = queryset.order_by("-donation_date", "-created_at", "donation_id")
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = search_encrypted_pii(queryset, search, DONATION_SEARCH_FIELDS)
        return queryset


class DonationDetailView(EncryptedPIIResponseMixin, generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a single donation record."""

    queryset = Donation.objects.all()
    serializer_class = DonationSerializer
    lookup_field = "donation_id"
    permission_classes = [HasFinancialRecordPermission]


class MembershipListCreateView(EncryptedPIIResponseMixin, generics.ListCreateAPIView):
    """List membership records; only admins can create manual records."""

    serializer_class = MembershipSerializer
    permission_classes = [HasFinancialRecordPermission]

    def create(self, request, *args, **kwargs):
        """Never expose a database exception or claim a failed creation succeeded."""
        try:
            return super().create(request, *args, **kwargs)
        except DatabaseError:
            # Do not include submitted membership fields or SQL in logs.
            logger.error("Database error while creating a membership.")
            return Response(
                {"detail": "Unable to save the membership at this time."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    def get_queryset(self):
        queryset = Membership.objects.all()

        email = self.request.query_params.get("email")
        payment_status = self.request.query_params.get("payment_status")
        status = self.request.query_params.get("status")
        membership_type = self.request.query_params.get("membership_type")
        reference_id = self.request.query_params.get("reference_id")

        if payment_status:
            queryset = queryset.filter(payment_status__iexact=payment_status)
        if status:
            queryset = queryset.filter(status__iexact=status)
        if membership_type:
            queryset = queryset.filter(membership_type__iexact=membership_type)
        if reference_id:
            queryset = queryset.filter(reference_id=reference_id)
        if email:
            queryset = filter_encrypted_email(queryset, "email_encrypted", email)

        queryset = queryset.order_by("-start_date", "-created_at", "membership_id")
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = search_encrypted_pii(
                queryset, search, MEMBERSHIP_SEARCH_FIELDS, "phone_encrypted",
            )
        return queryset


class MembershipDetailView(EncryptedPIIResponseMixin, generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a single membership record."""

    queryset = Membership.objects.all()
    serializer_class = MembershipSerializer
    lookup_field = "membership_id"
    # Do not let a public caller mark a membership paid/active or delete it
    # through the detail endpoint while the verified-payment flow is pending.
    permission_classes = [HasFinancialRecordPermission]

    def update(self, request, *args, **kwargs):
        """Return a controlled failure if a membership write does not complete."""
        try:
            return super().update(request, *args, **kwargs)
        except DatabaseError:
            logger.error("Database error while updating a membership.")
            return Response(
                {"detail": "Unable to save the membership at this time."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    def destroy(self, request, *args, **kwargs):
        """Do not report a successful deletion when the database rejected it."""
        try:
            return super().destroy(request, *args, **kwargs)
        except DatabaseError:
            logger.error("Database error while deleting a membership.")
            return Response(
                {"detail": "Unable to delete the membership at this time."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
