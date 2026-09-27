from datetime import date
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.test import TestCase

from .models import Donation
from .serializers import DonationSerializer


class DonationPaymentDataTests(TestCase):
    """Tests for the payment data restrictions on donations."""

    def create_donation(self, **overrides):
        data = {
            "donor_first_name": "Test",
            "donor_last_name": "Donor",
            "donor_email": "test@example.com",
            "amount": Decimal("10.00"),
            "donation_date": date.today(),
            "is_anonymous": False,
            "message": "",
            "reference_id": "DON-TEST",
        }
        data.update(overrides)
        return Donation.objects.create(**data)

    def test_new_donation_defaults_to_pending(self):
        donation = self.create_donation()

        self.assertEqual(donation.payment_status, Donation.PaymentStatus.PENDING)

    def test_serializer_ignores_client_controlled_payment_fields(self):
        serializer = DonationSerializer(
            data={
                "donor_first_name": "Test",
                "donor_last_name": "Donor",
                "donor_email": "test@example.com",
                "amount": "10.00",
                "is_anonymous": False,
                "message": "",
                "payment_status": Donation.PaymentStatus.COMPLETED,
                "reference_id": "CLIENT-CONTROLLED",
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        donation = serializer.save()

        self.assertEqual(donation.payment_status, Donation.PaymentStatus.PENDING)
        self.assertEqual(donation.reference_id, f"DON-{donation.donation_id:08d}")

    def test_all_expected_payment_statuses_are_allowed(self):
        donation = self.create_donation()

        for status in Donation.PaymentStatus.values:
            Donation.objects.filter(pk=donation.pk).update(payment_status=status)
            donation.refresh_from_db()
            self.assertEqual(donation.payment_status, status)

    def test_database_rejects_an_unsupported_payment_status(self):
        donation = self.create_donation()

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Donation.objects.filter(pk=donation.pk).update(
                    payment_status="invalid"
                )

        donation.refresh_from_db()
        self.assertEqual(donation.payment_status, Donation.PaymentStatus.PENDING)