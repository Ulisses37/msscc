from datetime import date
from decimal import Decimal
from importlib import import_module
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.db import DatabaseError, IntegrityError, transaction
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory

from .models import AdminTableRevision, Donation
from .serializers import DonationSerializer
from .views import DonationListCreateView

User = get_user_model()


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


class AdminTableRevisionTriggerMigrationTests(TestCase):
    """Tests for the PostgreSQL revision-trigger migration."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.migration = import_module("donations.migrations.0005_admin_table_revision_triggers")

    def create_schema_editor(self, vendor):
        """Return a mock schema editor for the requested database vendor."""
        schema_editor = MagicMock()
        schema_editor.connection.vendor = vendor
        return schema_editor

    def test_postgresql_setup_creates_function_and_table_specific_triggers(self):
        """Create one statement-level trigger for each refreshable admin table."""
        schema_editor = self.create_schema_editor("postgresql")
        cursor = schema_editor.connection.cursor.return_value.__enter__.return_value

        self.migration.create_admin_table_revision_triggers(None, schema_editor)

        executed_sql = [call.args[0] for call in cursor.execute.call_args_list]
        self.assertEqual(len(executed_sql), 3)
        self.assertIn("CREATE FUNCTION bump_admin_table_revision()", executed_sql[0])
        self.assertIn("revision = revision + 1", executed_sql[0])
        self.assertIn("changed_at = CURRENT_TIMESTAMP", executed_sql[0])
        self.assertIn("WHERE table_name = TG_ARGV[0]", executed_sql[0])
        self.assertIn("ON donations_donation", executed_sql[1])
        self.assertIn("bump_admin_table_revision('donations')", executed_sql[1])
        self.assertIn("ON donations_membership", executed_sql[2])
        self.assertIn("bump_admin_table_revision('memberships')", executed_sql[2])

    def test_non_postgresql_setup_skips_trigger_ddl(self):
        """Keep SQLite test database setup compatible with PostgreSQL-only triggers."""
        schema_editor = self.create_schema_editor("sqlite")

        self.migration.create_admin_table_revision_triggers(None, schema_editor)

        schema_editor.connection.cursor.assert_not_called()

    def test_postgresql_reverse_drops_triggers_before_shared_function(self):
        """Drop dependent triggers before their shared PostgreSQL function."""
        schema_editor = self.create_schema_editor("postgresql")
        cursor = schema_editor.connection.cursor.return_value.__enter__.return_value

        self.migration.remove_admin_table_revision_triggers(None, schema_editor)

        executed_sql = [call.args[0] for call in cursor.execute.call_args_list]
        self.assertEqual(len(executed_sql), 3)
        self.assertIn("DROP TRIGGER IF EXISTS donations_bump_admin_table_revision", executed_sql[0])
        self.assertIn(
            "DROP TRIGGER IF EXISTS memberships_bump_admin_table_revision",
            executed_sql[1],
        )
        self.assertEqual(executed_sql[2], "DROP FUNCTION IF EXISTS bump_admin_table_revision();")


class AdminTableRevisionAPITests(TestCase):
    """Tests for the admin table revision refresh endpoint."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="admin@example.com",
            password="TestPass123!",
            first_name="Admin",
            last_name="User",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_get_returns_current_revisions_without_table_data(self):
        """Return the two current refresh tokens in one request."""
        AdminTableRevision.objects.filter(table_name="donations").update(revision=12)
        AdminTableRevision.objects.filter(table_name="memberships").update(revision=4)

        response = self.client.get("/api/donations/table-revisions/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"donations": 12, "memberships": 4})

    def test_get_returns_controlled_error_when_revision_record_is_missing(self):
        """Do not fabricate a refresh token when revision setup is incomplete."""
        AdminTableRevision.objects.filter(table_name="memberships").delete()

        with self.assertLogs("donations.views", level="ERROR"):
            response = self.client.get("/api/donations/table-revisions/")

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(
            response.json(),
            {"detail": "Table revisions are temporarily unavailable."},
        )

    @patch("donations.views.AdminTableRevision.objects.filter")
    def test_get_returns_controlled_error_when_revision_query_fails(self, filter_revisions):
        """Keep database failure details out of the revision polling response."""
        filter_revisions.side_effect = DatabaseError("database-secret-for-test")

        with self.assertLogs("donations.views", level="ERROR") as captured_logs:
            response = self.client.get("/api/donations/table-revisions/")

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(
            response.json(),
            {"detail": "Table revisions are temporarily unavailable."},
        )
        exposed_text = f"{response.json()} {' '.join(captured_logs.output)}"
        self.assertNotIn("database-secret-for-test", exposed_text)

    def test_get_requires_authentication(self):
        """Keep internal revision state unavailable to unauthenticated clients."""
        client = APIClient()

        response = client.get("/api/donations/table-revisions/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class MembershipInputBoundaryTests(TestCase):
    """Public checkout must not be able to create a paid membership directly."""

    def test_public_cannot_create_an_active_membership(self):
        from .models import Membership

        # The public payment flow must not bypass Stripe verification by
        # posting arbitrary paid/active flags directly to the record API.
        response = APIClient().post(
            "/api/donations/memberships/",
            {"first_name": "O'Connor", "last_name": "Anne-Marie",
             "amount_paid": "0.01", "payment_status": "completed", "status": "active"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(Membership.objects.count(), 0)

    def test_public_cannot_update_or_delete_an_existing_membership(self):
        from .models import Membership

        membership = Membership.objects.create(
            first_name="O'Connor", last_name="Anne-Marie", email="member@example.com",
            phone="555-0100", membership_type="student", amount_paid=Decimal("20.00"),
            start_date=date.today(), end_date=date.today(), renewal_date=date.today(),
            payment_status="pending", reference_id="MEM-00000001", status="pending", notes="",
        )
        url = f"/api/donations/memberships/{membership.pk}/"
        client = APIClient()
        self.assertEqual(client.patch(url, {"status": "active"}, format="json").status_code,
                         status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(client.delete(url).status_code, status.HTTP_401_UNAUTHORIZED)
        membership.refresh_from_db()
        self.assertEqual(membership.status, "pending")
        self.assertEqual(Membership.objects.count(), 1)
