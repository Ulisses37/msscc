from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.db import DatabaseError, IntegrityError, transaction
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIRequestFactory

from .models import AdminTableRevision, Donation
from .serializers import DonationSerializer
from .views import DonationListCreateView


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

        for payment_status_value in Donation.PaymentStatus.values:
            Donation.objects.filter(pk=donation.pk).update(payment_status=payment_status_value)
            donation.refresh_from_db()
            self.assertEqual(donation.payment_status, payment_status_value)

    def test_database_rejects_an_unsupported_payment_status(self):
        donation = self.create_donation()

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Donation.objects.filter(pk=donation.pk).update(
                    payment_status="invalid"
                )

        donation.refresh_from_db()
        self.assertEqual(donation.payment_status, Donation.PaymentStatus.PENDING)


class DonationDatabaseFailureTests(TestCase):
    """Tests for atomic creation and controlled database failure responses."""

    def setUp(self):
        self.request_data = {
            "donor_first_name": "Test",
            "donor_last_name": "Donor",
            "donor_email": "test@example.com",
            "amount": "10.00",
            "is_anonymous": False,
            "message": "",
        }

    def test_reference_write_failure_rolls_back_the_new_donation(self):
        serializer = DonationSerializer(data=self.request_data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        original_save = Donation.save

        def fail_reference_save(instance, *args, **kwargs):
            if kwargs.get("update_fields") == ["reference_id"]:
                raise DatabaseError("database-secret-for-test")
            return original_save(instance, *args, **kwargs)

        with patch.object(Donation, "save", new=fail_reference_save):
            with self.assertRaises(DatabaseError):
                serializer.save()

        self.assertEqual(Donation.objects.count(), 0)

    @patch("donations.views.DonationSerializer.save")
    def test_creation_database_error_returns_a_safe_response(self, save):
        save.side_effect = DatabaseError("database-secret-for-test")
        request = APIRequestFactory().post(
            "/api/donations/",
            self.request_data,
            format="json",
        )

        with self.assertLogs("donations.views", level="ERROR") as captured_logs:
            response = DonationListCreateView.as_view()(request)

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(
            response.data,
            {"detail": "Unable to save the donation at this time."},
        )
        exposed_text = f"{response.data} {' '.join(captured_logs.output)}"
        self.assertNotIn("database-secret-for-test", exposed_text)


class AdminTableRevisionTests(TestCase):
    """Tests for initial admin table revision records."""

    def test_initial_revision_records_exist_with_zero_revision(self):
        """Ensure every refreshable admin table starts at the initial revision."""
        revisions = AdminTableRevision.objects.in_bulk(field_name="table_name")

        # This guards the data migration against missing or unintended polling targets.
        self.assertEqual(set(revisions), {"donations", "memberships"})
        self.assertEqual(revisions["donations"].revision, 0)
        self.assertEqual(revisions["memberships"].revision, 0)

    def test_model_uses_required_table_name_configuration(self):
        """Protect identifiers that the revision triggers and API will depend on."""
        table_name_field = AdminTableRevision._meta.get_field("table_name")

        # A primary key permits only one revision record for each tracked table.
        self.assertTrue(table_name_field.primary_key)
        self.assertEqual(table_name_field.max_length, 32)
        self.assertEqual(
            dict(table_name_field.choices),
            {
                "donations": "Donations",
                "memberships": "Memberships",
            },
        )
        # PostgreSQL triggers in SCRUM-690 will reference this table directly.
        self.assertEqual(
            AdminTableRevision._meta.db_table,
            "donations_admin_table_revision",
        )
