from datetime import date, timedelta
from decimal import Decimal
from importlib import import_module
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.db import DatabaseError, IntegrityError, transaction
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory

from emails.providers import ProviderError

from .membership_reminders import (
    CLAIM_LOST,
    REMINDER_WINDOW,
    ReminderSelection,
    claim_member_for_reminder,
    is_blocked_payment_status,
    is_cancelled_status,
    is_sendable_email,
    release_member_claim,
    run_membership_expiry_reminders,
    select_members_due_for_reminder,
)
from .models import AdminTableRevision, Donation, Membership
from .processing_costs import calculate_donation_amounts
from .serializers import DonationSerializer
from .views import DonationListCreateView

User = get_user_model()


class DonationPaymentDataTests(TestCase):
    """Tests for the payment data restrictions on donations."""

    def create_donation(self, **overrides):
        data = {
            "donor_first_name_encrypted": "Test",
            "donor_last_name_encrypted": "Donor",
            "donor_email_encrypted": "test@example.com",
            "amount": Decimal("10.00"),
            "donation_date": date.today(),
            "is_anonymous": False,
            "message": "",
            "reference_id": "DON-TEST",
        }
        data.update(overrides)
        return Donation.objects.create(**data)

    def test_public_anonymous_donation_replaces_supplied_names_and_keeps_email(self):
        """The public API must enforce anonymity even if the browser sends PII."""
        response = APIClient().post("/api/donations/", {
            "donor_first_name": "Ada", "donor_last_name": "Lovelace",
            "donor_email": " Donor@Example.com ", "amount": "10.00",
            "is_anonymous": True,
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        donation = Donation.objects.get(pk=response.data["donation_id"])
        self.assertTrue(donation.is_anonymous)
        self.assertEqual(donation.donor_first_name_encrypted, "Anonymous")
        self.assertEqual(donation.donor_last_name_encrypted, "")
        self.assertEqual(donation.donor_email_encrypted, "donor@example.com")
        self.assertEqual(response.data["donor_first_name"], "Anonymous")
        self.assertEqual(response.data["donor_last_name"], "")
        self.assertEqual(response.data["donor_email"], "donor@example.com")
        self.assertNotIn("Ada", str(response.data))
        self.assertNotIn("Lovelace", str(response.data))

    def test_public_anonymous_donation_needs_only_email_not_names_or_address(self):
        """No fabricated name, address, country or postcode is required."""
        response = APIClient().post("/api/donations/", {
            "donor_email": "donor@example.com", "amount": "5.00",
            "is_anonymous": True,
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        donation = Donation.objects.get(pk=response.data["donation_id"])
        self.assertEqual(donation.donor_first_name_encrypted, "Anonymous")
        self.assertEqual(donation.donor_last_name_encrypted, "")
        self.assertEqual(donation.donor_email_encrypted, "donor@example.com")
        self.assertIsNone(donation.donor_address_encrypted)

    def test_email_remains_required_and_valid_for_anonymous_donations(self):
        for email in (None, "", "not-an-email"):
            with self.subTest(email=email):
                payload = {"amount": "5.00", "is_anonymous": True}
                if email is not None:
                    payload["donor_email"] = email
                response = APIClient().post("/api/donations/", payload, format="json")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("donor_email", response.data)
        self.assertEqual(Donation.objects.count(), 0)

    def test_non_anonymous_creation_still_requires_and_saves_real_names(self):
        data = {
            "donor_email": "donor@example.com", "amount": "5.00", "is_anonymous": False,
            "address": "123 Main Street",
        }
        for payload in (data, {**data, "donor_first_name": "Ada", "donor_last_name": " "}):
            response = APIClient().post("/api/donations/", payload, format="json")
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("donor_last_name", response.data)
        response = APIClient().post("/api/donations/", {
            **data, "donor_first_name": " Ada ", "donor_last_name": " Lovelace ",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        donation = Donation.objects.get(pk=response.data["donation_id"])
        self.assertFalse(donation.is_anonymous)
        self.assertEqual(donation.donor_first_name_encrypted, "Ada")
        self.assertEqual(donation.donor_last_name_encrypted, "Lovelace")

    def test_authorized_edits_cannot_restore_a_name_while_anonymous(self):
        user = User.objects.create_user(
            email="finance-anonymity@example.test", permissions_data={"Finances": True},
        )
        client = APIClient()
        client.force_authenticate(user=user)
        donation = self.create_donation()
        url = f"/api/donations/{donation.pk}/"
        response = client.patch(url, {"is_anonymous": True}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        response = client.patch(url, {
            "donor_first_name": "Reintroduced", "donor_last_name": "Person",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        donation.refresh_from_db()
        self.assertTrue(donation.is_anonymous)
        self.assertEqual(donation.donor_first_name_encrypted, "Anonymous")
        self.assertEqual(donation.donor_last_name_encrypted, "")
        self.assertEqual(donation.donor_email_encrypted, "test@example.com")
        # Removing the flag must not silently leave a nameless ordinary row.
        response = client.patch(url, {"is_anonymous": False}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response = client.patch(url, {
            "is_anonymous": False, "donor_first_name": "Ada", "donor_last_name": "Lovelace",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        donation.refresh_from_db()
        self.assertFalse(donation.is_anonymous)
        self.assertEqual(donation.donor_first_name_encrypted, "Ada")
        self.assertEqual(donation.donor_last_name_encrypted, "Lovelace")

    def test_new_donation_defaults_to_pending(self):
        donation = self.create_donation()

        self.assertEqual(donation.payment_status, Donation.PaymentStatus.PENDING)
        self.assertFalse(donation.contribute_to_processing_costs)
        self.assertEqual(donation.processing_cost_contribution, Decimal("0.00"))
        self.assertEqual(donation.total_amount, donation.amount)

    def test_direct_model_creation_initializes_total_from_its_base(self):
        """Legacy and internal callers should not need a constant total default."""
        donation = self.create_donation(amount=Decimal("27.45"))
        donation.refresh_from_db()
        self.assertEqual(donation.total_amount, Decimal("27.45"))
        self.assertEqual(donation.processing_cost_contribution, Decimal("0.00"))

    def test_public_donation_api_persists_selected_and_omitted_choices(self):
        """Exercise the actual endpoint without requiring the development server."""
        data = {
            "donor_first_name": "Test", "donor_last_name": "Donor",
            "donor_email": "test@example.com", "amount": "12.50",
            "address": "123 Main Street",
        }
        for choice in (True, False, None):
            with self.subTest(choice=choice):
                payload = data | (
                    {"contribute_to_processing_costs": choice} if choice is not None else {}
                )
                response = APIClient().post("/api/donations/", payload, format="json")
                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                donation = Donation.objects.get(pk=response.data["donation_id"])
                self.assertEqual(donation.contribute_to_processing_costs, choice is True)
                self.assertEqual(donation.amount, Decimal("12.50"))
                self.assertEqual(
                    donation.processing_cost_contribution,
                    Decimal("0.68") if choice else Decimal("0.00"),
                )
                self.assertEqual(
                    donation.total_amount, Decimal("13.18") if choice else Decimal("12.50")
                )
                self.assertEqual(response.data["contribute_to_processing_costs"], choice is True)
                self.assertEqual(
                    response.data["processing_cost_contribution"], "0.68" if choice else "0.00"
                )
                self.assertEqual(response.data["total_amount"], "13.18" if choice else "12.50")

    def test_client_cannot_override_calculated_amounts_on_create_or_update(self):
        payload = {
            "donor_first_name": "Test", "donor_last_name": "Donor",
            "donor_email": "test@example.com", "amount": "10.00",
            "contribute_to_processing_costs": True,
            "address": "123 Main Street",
            "processing_cost_contribution": "999.00", "total_amount": "1009.00",
        }
        client = APIClient()
        response = client.post("/api/donations/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        donation = Donation.objects.get(pk=response.data["donation_id"])
        self.assertEqual(donation.total_amount, Decimal("10.61"))
        self.assertEqual(donation.processing_cost_contribution, Decimal("0.61"))

        user = User.objects.create_user(
            email="finance@example.test", permissions_data={"Finances": True},
        )
        client.force_authenticate(user=user)
        url = f"/api/donations/{donation.pk}/"
        response = client.patch(url, {
            "amount": "14.25", "processing_cost_contribution": "900.00",
            "total_amount": "914.25",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        donation.refresh_from_db()
        self.assertEqual(donation.amount, Decimal("14.25"))
        self.assertEqual(donation.processing_cost_contribution, Decimal("0.73"))
        self.assertEqual(donation.total_amount, Decimal("14.98"))

    def test_completed_donation_keeps_paid_breakdown_after_admin_edits(self):
        donation = self.create_donation(
            amount=Decimal("10.00"), contribute_to_processing_costs=True,
            processing_cost_contribution=Decimal("0.61"), total_amount=Decimal("10.61"),
            payment_status=Donation.PaymentStatus.COMPLETED,
        )
        user = User.objects.create_user(
            email="finance-paid@example.test", permissions_data={"Finances": True},
        )
        client = APIClient()
        client.force_authenticate(user=user)
        url = f"/api/donations/{donation.pk}/"
        for change in ({"amount": "20.00"}, {"contribute_to_processing_costs": False}):
            with self.subTest(change=change):
                response = client.patch(url, change, format="json")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Even repeating the same input after pricing changes must not rewrite
        # what the payer paid or what their receipt will display.
        with patch("donations.serializers.calculate_donation_amounts", return_value=(
            Decimal("1.00"), Decimal("11.00")
        )) as calculate:
            response = client.patch(url, {"amount": "10.00"}, format="json")
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            calculate.assert_called_once()  # Validation, but no persistence recalculation.
        response = client.patch(url, {"message": "Thank you"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        donation.refresh_from_db()
        self.assertEqual(donation.amount, Decimal("10.00"))
        self.assertEqual(donation.processing_cost_contribution, Decimal("0.61"))
        self.assertEqual(donation.total_amount, Decimal("10.61"))
        self.assertEqual(donation.message, "Thank you")

    def test_public_quote_matches_saved_donation_and_rejects_supplied_totals(self):
        """The preview cannot be a second pricing rule or accept a forged total."""
        client = APIClient()
        for amount, choice in (("0.01", True), ("12.50", True), ("12.50", False)):
            with self.subTest(amount=amount, choice=choice):
                data = {"amount": amount, "contribute_to_processing_costs": choice}
                quote = client.post("/api/donations/quote/", data, format="json")
                self.assertEqual(quote.status_code, 200)
                saved = client.post("/api/donations/", {
                    **data, "donor_first_name": "Test", "donor_last_name": "Donor",
                    "donor_email": "test@example.com",
                    "address": "123 Main Street",
                }, format="json")
                self.assertEqual(saved.status_code, 201)
                for key in ("amount", "processing_cost_contribution", "total_amount"):
                    self.assertEqual(quote.data[key], saved.data[key])
        for forged in ({"total_amount": "0.01"}, {"processing_cost_contribution": "0.00"},
                       {"contribute_to_processing_costs": "true"}):
            response = client.post(
                "/api/donations/quote/", {"amount": "5.00", **forged}, format="json"
            )
            self.assertEqual(response.status_code, 400)

    def test_gross_up_is_minimal_and_never_exceeds_decimal_field(self):
        """One cent less must fail to cover the estimated fee on the full charge."""
        for cents in (1, 2, 5, 30, 33, 100, 500, 1250, 10000, 9700000000):
            with self.subTest(cents=cents):
                base = Decimal(cents) / 100
                extra, total = calculate_donation_amounts(base, True)
                self.assertEqual(total, base + extra)
                def fee(value):
                    return (value * Decimal("0.029") + Decimal("0.30")).quantize(
                        Decimal("0.01"), rounding="ROUND_HALF_UP"
                    )
                self.assertGreaterEqual(total - fee(total), base)
                self.assertLess(total - Decimal("0.01") - fee(total - Decimal("0.01")), base)
        with self.assertRaises(ValueError):
            calculate_donation_amounts(Decimal("99999999.99"), True)

    def test_gross_up_rounding_examples(self):
        """Protect exact-cent behavior under the currently configured rate."""
        # These are regression examples for the current 2.9% + $0.30 estimate,
        # not confirmation that it matches the account's contracted Stripe rate.
        for base, contribution, total in (
            ("0.01", "0.31", "0.32"),
            ("0.33", "0.32", "0.65"),
            ("1.00", "0.34", "1.34"),
            ("5.00", "0.46", "5.46"),
            ("12.50", "0.68", "13.18"),
        ):
            with self.subTest(base=base):
                self.assertEqual(
                    calculate_donation_amounts(Decimal(base), True),
                    (Decimal(contribution), Decimal(total)),
                )
                self.assertEqual(
                    calculate_donation_amounts(Decimal(base), False),
                    (Decimal("0.00"), Decimal(base)),
                )

    def test_choice_requires_a_boolean_not_a_fee_amount(self):
        for choice in ("yes", 1, [True], {"value": True}):
            with self.subTest(choice=choice):
                response = APIClient().post("/api/donations/", {
                    "donor_first_name": "Test", "donor_last_name": "Donor",
                    "donor_email": "test@example.com", "amount": "10.00",
                    "contribute_to_processing_costs": choice,
                }, format="json")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Donation.objects.count(), 0)

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
            "address": "123 Main Street",
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
            first_name_encrypted="O'Connor", last_name_encrypted="Anne-Marie",
            email_encrypted="member@example.com", phone_encrypted="555-0100",
            membership_type="student", amount_paid=Decimal("20.00"),
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


class MembershipPaymentSecurityRegressionTests(TestCase):
    """Exercise application-owned free text without confusing it with SQL."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="secure-admin@example.com", password="TestPass123!",
            first_name="Admin", last_name="User", is_staff=True,
            permissions_data={"Finances": True},
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def membership_data(self, **overrides):
        data = {
            "first_name": "O'Connor", "last_name": "Anne-Marie", "email": "member@example.com",
            "phone": "555-0100", "membership_type": "student", "amount_paid": "20.00",
            "start_date": "2026-01-01", "end_date": "2027-01-01",
            "renewal_date": "2027-01-01", "payment_status": "pending",
            "reference_id": "MEM-00000001", "status": "pending", "notes": "Normal note",
        }
        data.update(overrides)
        return data

    def test_names_with_apostrophes_hyphens_and_unicode_are_data(self):
        response = self.client.post(
            "/api/donations/memberships/",
            self.membership_data(first_name="O'Connor", last_name="Anne-Marie 日本"), format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        member = Membership.objects.get()
        self.assertEqual(member.first_name_encrypted, "O'Connor")
        self.assertEqual(member.last_name_encrypted, "Anne-Marie 日本")

    def test_sql_like_input_in_every_membership_text_field_is_only_data(self):
        # A quoted Boolean condition plus a SQL comment is valid free text.
        # Manual-entry fields retain their own values; no other row is changed.
        payload = "O'Connor' OR '1'='1 --"
        for field in ("first_name", "last_name", "phone", "membership_type",
                      "reference_id", "notes"):
            with self.subTest(field=field):
                response = self.client.post(
                    "/api/donations/memberships/",
                    self.membership_data(**{field: payload}), format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                member = Membership.objects.get(pk=response.data["membership_id"])
                stored_field = f"{field}_encrypted" if field in (
                    "first_name", "last_name", "phone"
                ) else field
                self.assertEqual(getattr(member, stored_field), payload)
        self.assertEqual(Membership.objects.count(), 6)
        # Statuses and methods are structured choices, not free-text fields.
        for field in ("payment_status", "status", "payment_method"):
            with self.subTest(field=field):
                response = self.client.post(
                    "/api/donations/memberships/",
                    self.membership_data(**{field: payload}), format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field, response.data)
        self.assertEqual(Membership.objects.count(), 6)
        self.assertFalse(Membership.objects.filter(status="active").exists())

    def test_sql_like_membership_email_is_rejected_without_creating_a_row(self):
        # An email is structured input, unlike free-text names and notes.
        response = self.client.post(
            "/api/donations/memberships/",
            self.membership_data(email="' OR 1=1 --"), format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)
        self.assertEqual(Membership.objects.count(), 0)

    def test_sql_like_membership_filter_does_not_return_an_unrelated_row(self):
        for email, reference in (("one@example.com", "MEM-00000001"),
                                 ("two@example.com", "MEM-00000002")):
            response = self.client.post(
                "/api/donations/memberships/",
                self.membership_data(email=email, reference_id=reference), format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        for field in ("email", "membership_type", "payment_status", "status", "reference_id"):
            with self.subTest(field=field):
                response = self.client.get(
                    "/api/donations/memberships/", {field: "' OR 1=1 --"}
                )
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(response.data, [])
        self.assertEqual(Membership.objects.count(), 2)

    def test_missing_oversized_and_mistyped_membership_fields_do_not_create_rows(self):
        for field in ("first_name", "last_name", "membership_type", "status"):
            with self.subTest(missing=field):
                response = self.client.post(
                    "/api/donations/memberships/",
                    {key: value for key, value in self.membership_data().items() if key != field},
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field, response.data)
        for field in ("first_name", "last_name", "email", "membership_type", "notes"):
            with self.subTest(field=field):
                response = self.client.post(
                    "/api/donations/memberships/",
                    self.membership_data(**{field: "x" * (501 if field == "notes" else 256)}),
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field, response.data)
        for field in ("first_name", "last_name", "email", "phone", "membership_type",
                      "payment_status", "reference_id", "status", "notes"):
            with self.subTest(field=field):
                response = self.client.post(
                    "/api/donations/memberships/",
                    self.membership_data(**{field: ["not text"]}), format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response = self.client.post(
            "/api/donations/memberships/", self.membership_data(first_name=""), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Membership.objects.count(), 0)

    @patch("donations.views.Membership.objects.create")
    def test_failed_membership_creation_has_safe_response_and_logs(self, create_member):
        # The raised text imitates a backend exception containing schema and
        # connection details; neither should appear in an HTTP response or log.
        secret = "SQL table membership password=private-test-value"
        create_member.side_effect = DatabaseError(secret)
        with self.assertLogs("donations.views", level="ERROR") as captured:
            response = self.client.post(
                "/api/donations/memberships/", self.membership_data(), format="json"
            )
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertNotIn(secret, str(response.data) + str(captured.output))
        self.assertEqual(Membership.objects.count(), 0)

    def test_failed_membership_update_and_delete_leave_the_record_intact(self):
        response = self.client.post(
            "/api/donations/memberships/", self.membership_data(), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        member = Membership.objects.get(pk=response.data["membership_id"])
        url = f"/api/donations/memberships/{member.pk}/"
        secret = "SQL table membership password=private-test-value"

        # Patch only the write/delete boundaries; read the real row afterward.
        with patch.object(Membership, "save", side_effect=DatabaseError(secret)):
            with self.assertLogs("donations.views", level="ERROR") as captured:
                update = self.client.patch(url, {"status": "active"}, format="json")
        self.assertEqual(update.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertNotIn(secret, str(update.data) + str(captured.output))
        member.refresh_from_db()
        self.assertEqual(member.status, "pending")

        with patch.object(Membership, "delete", side_effect=DatabaseError(secret)):
            with self.assertLogs("donations.views", level="ERROR") as captured:
                deletion = self.client.delete(url)
        self.assertEqual(deletion.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertNotIn(secret, str(deletion.data) + str(captured.output))
        self.assertEqual(Membership.objects.count(), 1)

    def test_donation_free_text_preserves_sql_like_message_and_apostrophes(self):
        # A donation note is not a database instruction. Its reference and
        # payment state must still be generated by the application.
        message = "O'Connor said: SELECT * FROM donors -- thanks"
        response = self.client.post(
            "/api/donations/",
            {"donor_first_name": "O'Connor", "donor_last_name": "Anne-Marie",
             "donor_email": "donor@example.com", "amount": "10.00",
             "address": "123 Main Street",
             "message": message, "payment_status": "completed",
             "reference_id": "DON-00000001' OR 1=1 --"}, format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        donation = Donation.objects.get()
        self.assertEqual(donation.message, message)
        self.assertEqual(donation.donor_first_name_encrypted, "O'Connor")
        self.assertEqual(donation.payment_status, Donation.PaymentStatus.PENDING)
        self.assertEqual(donation.reference_id, f"DON-{donation.pk:08d}")

    def test_sql_like_donation_names_and_message_remain_data(self):
        # Each application-owned free-text field is exercised separately so
        # a future query change cannot accidentally treat one as a predicate.
        payload = "O'Connor' OR '1'='1 --"
        base = {
            "donor_first_name": "First", "donor_last_name": "Last",
            "donor_email": "donor@example.com", "amount": "10.00", "message": "Safe",
            "address": "123 Main Street",
        }
        for field in ("donor_first_name", "donor_last_name", "message"):
            with self.subTest(field=field):
                response = self.client.post(
                    "/api/donations/", {**base, field: payload}, format="json"
                )
                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                donation = Donation.objects.get(pk=response.data["donation_id"])
                stored_field = f"{field}_encrypted" if field != "message" else field
                self.assertEqual(getattr(donation, stored_field), payload)
                self.assertEqual(donation.payment_status, Donation.PaymentStatus.PENDING)
        self.assertEqual(Donation.objects.count(), 3)

        # Email is structured input; no SQL-looking address may create a row.
        response = self.client.post(
            "/api/donations/", {**base, "donor_email": "' OR 1=1 --"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Donation.objects.count(), 3)

        # Exact ORM filtering must not expose those three rows to a malicious
        # email or reference query through the authenticated record API.
        for field in ("donor_email", "reference_id"):
            with self.subTest(lookup=field):
                response = self.client.get("/api/donations/", {field: "' OR 1=1 --"})
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(response.data, [])


class MembershipReminderSelectionTests(TestCase):
    """Select only members whose term is genuinely ending and not yet reminded."""

    TODAY = date(2026, 6, 1)

    def create_membership(self, **overrides):
        """Create a membership with a known expiring term, varying one field."""
        values = {
            "first_name_encrypted": "Maya",
            "last_name_encrypted": "Chen",
            "email_encrypted": "member@example.test",
            "membership_type": "individual",
            "status": "active",
            "start_date": self.TODAY - timedelta(days=351),
            "end_date": self.TODAY + timedelta(days=14),
            "renewal_date": self.TODAY + timedelta(days=15),
            "reference_id": "MEM-REMINDER",
            "notes": "",
        }
        values.update(overrides)
        return Membership.objects.create(**values)

    def selected_ids(self, **kwargs):
        """Return the selected primary keys for the default window."""
        return [m.membership_id for m in select_members_due_for_reminder(**kwargs).members]

    def test_member_inside_the_window_is_selected(self):
        membership = self.create_membership()

        self.assertEqual(self.selected_ids(today=self.TODAY), [membership.membership_id])

    def test_term_ending_today_is_selected(self):
        membership = self.create_membership(end_date=self.TODAY)

        self.assertEqual(self.selected_ids(today=self.TODAY), [membership.membership_id])

    def test_term_beyond_the_window_is_not_selected(self):
        self.create_membership(end_date=self.TODAY + REMINDER_WINDOW + timedelta(days=1))

        self.assertEqual(self.selected_ids(today=self.TODAY), [])

    def test_already_expired_term_is_not_selected(self):
        self.create_membership(end_date=self.TODAY - timedelta(days=1))

        self.assertEqual(self.selected_ids(today=self.TODAY), [])

    def test_member_without_an_expiry_date_is_never_selected(self):
        # Lifetime memberships are recorded without an end_date, which is what
        # keeps them out of the reminder without matching a membership_type.
        self.create_membership(end_date=None, membership_type="Historical lifetime")

        self.assertEqual(self.selected_ids(today=self.TODAY), [])

    def test_days_argument_overrides_the_default_window(self):
        membership = self.create_membership(end_date=self.TODAY + timedelta(days=30))

        self.assertEqual(self.selected_ids(today=self.TODAY), [])
        self.assertEqual(self.selected_ids(today=self.TODAY, days=30), [membership.membership_id])

    def test_results_are_ordered_by_expiry_then_id(self):
        far = self.create_membership(end_date=self.TODAY + timedelta(days=10))
        near = self.create_membership(
            email_encrypted="second@example.test", end_date=self.TODAY + timedelta(days=2)
        )

        self.assertEqual(
            self.selected_ids(today=self.TODAY), [near.membership_id, far.membership_id]
        )

    def test_cancelled_statuses_are_excluded(self):
        for blocked in ("inactive", "canceled", "cancelled", "expired", "pending"):
            with self.subTest(status=blocked):
                Membership.objects.all().delete()
                self.create_membership(status=blocked)
                self.assertEqual(self.selected_ids(today=self.TODAY), [])

    def test_casing_and_padding_of_cancelled_statuses_is_still_excluded(self):
        # The queryset filter is an exact match, so these variants depend on the
        # shared helper rather than on the database lookup.
        for blocked in ("Cancelled", "CANCELED ", "  Inactive", "Expired"):
            with self.subTest(status=blocked):
                Membership.objects.all().delete()
                self.create_membership(status=blocked)
                self.assertEqual(self.selected_ids(today=self.TODAY), [])

    def test_unknown_historical_status_is_still_selected(self):
        # "unknown" is the documented status for historical members, so an
        # allowlist on "active" would wrongly drop them.
        membership = self.create_membership(status="unknown", membership_type="historical")

        self.assertEqual(self.selected_ids(today=self.TODAY), [membership.membership_id])

    def test_explicitly_failed_or_canceled_payments_are_excluded(self):
        for blocked in ("failed", "canceled"):
            with self.subTest(payment_status=blocked):
                Membership.objects.all().delete()
                self.create_membership(payment_status=blocked)
                self.assertEqual(self.selected_ids(today=self.TODAY), [])

    def test_null_waived_completed_and_pending_payments_stay_eligible(self):
        for allowed in (None, "waived", "completed", "pending", "Pending"):
            with self.subTest(payment_status=allowed):
                Membership.objects.all().delete()
                membership = self.create_membership(payment_status=allowed)
                self.assertEqual(self.selected_ids(today=self.TODAY), [membership.membership_id])

    def test_member_without_an_email_is_not_selected(self):
        self.create_membership(email_encrypted=None, reference_id="MEM-NONE")
        self.create_membership(email_encrypted="", reference_id="MEM-BLANK")

        self.assertEqual(self.selected_ids(today=self.TODAY), [])

    def test_malformed_email_is_not_selected(self):
        self.create_membership(email_encrypted="not-an-address")

        self.assertEqual(self.selected_ids(today=self.TODAY), [])

    def test_member_already_reminded_for_this_expiry_is_not_selected(self):
        membership = self.create_membership()
        membership.expiry_reminder_for = membership.end_date
        membership.save(update_fields=["expiry_reminder_for"])

        self.assertEqual(self.selected_ids(today=self.TODAY), [])

    def test_renewal_makes_the_member_eligible_again(self):
        membership = self.create_membership()
        membership.expiry_reminder_for = membership.end_date
        membership.save(update_fields=["expiry_reminder_for"])

        # A renewal moves end_date, which the stored reminder no longer matches.
        Membership.objects.filter(pk=membership.pk).update(
            end_date=self.TODAY + timedelta(days=9)
        )

        self.assertEqual(self.selected_ids(today=self.TODAY), [membership.membership_id])

    def test_missed_day_still_catches_the_member(self):
        # A run that did not happen yesterday must not skip the member: the
        # selector uses a window, not one exact day.
        membership = self.create_membership(end_date=self.TODAY + timedelta(days=1))

        self.assertEqual(self.selected_ids(today=self.TODAY), [membership.membership_id])

    def test_superseded_row_is_skipped_when_a_later_term_exists(self):
        self.create_membership(end_date=self.TODAY + timedelta(days=3))
        renewed = self.create_membership(
            end_date=self.TODAY + timedelta(days=12), reference_id="MEM-RENEWED"
        )

        # Only the later term is reminded; the older row is a superseded record.
        self.assertEqual(self.selected_ids(today=self.TODAY), [renewed.membership_id])

    def test_same_email_and_expiry_collapses_to_one_reminder(self):
        first = self.create_membership(reference_id="MEM-DUPLICATE-1")
        second = self.create_membership(
            email_encrypted="  MEMBER@Example.test  ", reference_id="MEM-DUPLICATE-2"
        )

        self.assertNotEqual(first.membership_id, second.membership_id)
        self.assertEqual(self.selected_ids(today=self.TODAY), [first.membership_id])

    def test_cancelled_sibling_does_not_suppress_a_live_expiring_term(self):
        live = self.create_membership(end_date=self.TODAY + timedelta(days=3))
        self.create_membership(
            status="canceled",
            end_date=self.TODAY + timedelta(days=12),
            reference_id="MEM-CANCELLED",
        )

        # A cancelled row is not evidence of a renewal.
        self.assertEqual(self.selected_ids(today=self.TODAY), [live.membership_id])

    def test_different_members_are_selected_independently(self):
        first = self.create_membership(reference_id="MEM-A")
        second = self.create_membership(
            email_encrypted="other@example.test",
            end_date=self.TODAY + timedelta(days=5),
            reference_id="MEM-B",
        )

        self.assertCountEqual(
            self.selected_ids(today=self.TODAY),
            [first.membership_id, second.membership_id],
        )


class MembershipReminderSkippedCountTests(TestCase):
    """Addressless rows are counted, not silently dropped, for the command tally."""

    TODAY = date(2026, 6, 1)

    def create_membership(self, **overrides):
        """Create a membership inside the window, varying one field."""
        values = {
            "first_name_encrypted": "Maya",
            "last_name_encrypted": "Chen",
            "email_encrypted": "member@example.test",
            "membership_type": "individual",
            "status": "active",
            "end_date": self.TODAY + timedelta(days=7),
            "reference_id": "MEM-SKIP",
            "notes": "",
        }
        values.update(overrides)
        return Membership.objects.create(**values)

    def test_selection_reports_no_skips_for_a_sendable_member(self):
        self.create_membership()

        result = select_members_due_for_reminder(today=self.TODAY)

        self.assertIsInstance(result, ReminderSelection)
        self.assertEqual(len(result.members), 1)
        self.assertEqual(result.skipped, 0)

    def test_blank_and_malformed_addresses_are_counted_as_skipped(self):
        self.create_membership(email_encrypted="", reference_id="MEM-BLANK")
        self.create_membership(email_encrypted="   ", reference_id="MEM-SPACES")
        self.create_membership(email_encrypted="not-an-address", reference_id="MEM-BAD")

        result = select_members_due_for_reminder(today=self.TODAY)

        self.assertEqual(result.members, [])
        self.assertEqual(result.skipped, 3)

    def test_skipped_count_excludes_sendable_members(self):
        sendable = self.create_membership(reference_id="MEM-OK")
        self.create_membership(email_encrypted="broken", reference_id="MEM-BROKEN")

        result = select_members_due_for_reminder(today=self.TODAY)

        self.assertEqual([m.membership_id for m in result.members], [sendable.membership_id])
        self.assertEqual(result.skipped, 1)

    def test_rows_without_a_nullable_email_column_are_not_counted(self):
        # A cancelled row is an ordinary business exclusion, not a skip, so the
        # count stays meaningful as "rows we could not even attempt".
        self.create_membership(status="canceled", email_encrypted="broken")

        result = select_members_due_for_reminder(today=self.TODAY)

        self.assertEqual(result.skipped, 0)

    def test_skipped_count_is_per_run_not_per_member(self):
        for index in range(4):
            self.create_membership(email_encrypted="bad", reference_id=f"MEM-BAD-{index}")

        self.assertEqual(select_members_due_for_reminder(today=self.TODAY).skipped, 4)


class MembershipReminderSameExpirySiblingTests(TestCase):
    """One reminder per member per expiry, across consecutive days."""

    TODAY = date(2026, 6, 1)
    EXPIRY = TODAY + timedelta(days=10)

    def create_membership(self, **overrides):
        """Create a membership for the shared expiry, varying one field."""
        values = {
            "first_name_encrypted": "Maya",
            "last_name_encrypted": "Chen",
            "email_encrypted": "member@example.test",
            "membership_type": "individual",
            "status": "active",
            "end_date": self.EXPIRY,
            "reference_id": "MEM-SIBLING",
            "notes": "",
        }
        values.update(overrides)
        return Membership.objects.create(**values)

    def remind(self, membership):
        """Record a reminder the way the command does."""
        membership.expiry_reminder_for = membership.end_date
        membership.save(update_fields=["expiry_reminder_for"])

    def test_sibling_sharing_a_reminded_expiry_is_not_emailed_the_next_day(self):
        first = self.create_membership(reference_id="MEM-FIRST")
        sibling = self.create_membership(reference_id="MEM-SECOND")

        # Day one: only the representative is selected.
        day_one = select_members_due_for_reminder(today=self.TODAY).members
        self.assertEqual([m.membership_id for m in day_one], [first.membership_id])

        # The command claims and sends for that representative.
        self.remind(first)

        # Day two: the sibling must not be emailed for the same expiry.
        day_two = select_members_due_for_reminder(
            today=self.TODAY + timedelta(days=1)
        ).members
        self.assertEqual(day_two, [])
        self.assertNotIn(sibling.membership_id, [m.membership_id for m in day_two])

    def test_the_reminded_row_itself_is_not_selected_again(self):
        first = self.create_membership()
        self.remind(first)

        self.assertEqual(select_members_due_for_reminder(today=self.TODAY).members, [])

    def test_sibling_is_selected_when_the_shared_expiry_was_not_reminded(self):
        first = self.create_membership(reference_id="MEM-FIRST")
        self.create_membership(reference_id="MEM-SECOND")

        result = select_members_due_for_reminder(today=self.TODAY)

        self.assertEqual([m.membership_id for m in result.members], [first.membership_id])

    def test_older_cycle_reminder_does_not_suppress_the_new_expiry(self):
        # expiry_reminder_for from last cycle must not block this cycle's expiry.
        first = self.create_membership(expiry_reminder_for=self.EXPIRY - timedelta(days=365))
        self.create_membership(reference_id="MEM-SECOND")

        result = select_members_due_for_reminder(today=self.TODAY)

        self.assertEqual([m.membership_id for m in result.members], [first.membership_id])


class MembershipReminderHelperTests(TestCase):
    """Free-text status and email checks shared by the selector and the guard."""

    def test_is_cancelled_status_matches_both_spellings_and_whitespace(self):
        for value in (
            "inactive", "canceled", "cancelled", "expired", "pending",
            "CANCELLED", "  Canceled  ", "Inactive",
        ):
            with self.subTest(value=value):
                self.assertTrue(is_cancelled_status(value))

    def test_is_cancelled_status_allows_current_and_unknown_values(self):
        for value in ("active", "unknown", "Active", "Historical", "", None):
            with self.subTest(value=value):
                self.assertFalse(is_cancelled_status(value))

    def test_is_blocked_payment_status_only_blocks_failed_and_canceled(self):
        for value in ("failed", "canceled", "FAILED ", "Canceled"):
            with self.subTest(value=value):
                self.assertTrue(is_blocked_payment_status(value))
        for value in (None, "", "waived", "completed", "pending", "unknown"):
            with self.subTest(value=value):
                self.assertFalse(is_blocked_payment_status(value))

    def test_is_sendable_email_rejects_blank_and_malformed_addresses(self):
        for value in (None, "", "   ", "not-an-address", "missing@tld"):
            with self.subTest(value=value):
                self.assertFalse(is_sendable_email(value))

    def test_is_sendable_email_accepts_a_normal_address(self):
        self.assertTrue(is_sendable_email("  Member@Example.test  "))


class MembershipReminderClaimTests(TestCase):
    """A claim is won once, and released only by the run that wrote it."""

    TODAY = date(2026, 6, 1)
    PREVIOUS_CYCLE = TODAY - timedelta(days=365)

    def create_membership(self, **overrides):
        """Create a membership eligible for a claim."""
        values = {
            "first_name_encrypted": "Maya",
            "last_name_encrypted": "Chen",
            "email_encrypted": "member@example.test",
            "membership_type": "individual",
            "status": "active",
            "end_date": self.TODAY + timedelta(days=7),
            "reference_id": "MEM-CLAIM",
            "notes": "",
        }
        values.update(overrides)
        return Membership.objects.create(**values)

    def stored_expiry(self, membership):
        """Read expiry_reminder_for back from the database, not from memory."""
        return Membership.objects.values_list(
            "expiry_reminder_for", flat=True
        ).get(pk=membership.pk)

    def test_first_claim_wins_and_returns_the_previous_value(self):
        membership = self.create_membership()

        previous = claim_member_for_reminder(membership, membership.end_date)

        self.assertIsNone(previous)
        self.assertEqual(self.stored_expiry(membership), membership.end_date)

    def test_claim_succeeds_when_no_previous_reminder_is_stored(self):
        membership = self.create_membership(expiry_reminder_for=None)

        previous = claim_member_for_reminder(membership, membership.end_date)

        self.assertIsNone(previous)
        self.assertEqual(self.stored_expiry(membership), membership.end_date)

    def test_claim_succeeds_over_an_older_cycle_date_and_returns_it(self):
        membership = self.create_membership(expiry_reminder_for=self.PREVIOUS_CYCLE)

        previous = claim_member_for_reminder(membership, membership.end_date)

        self.assertEqual(previous, self.PREVIOUS_CYCLE)
        self.assertEqual(self.stored_expiry(membership), membership.end_date)

    def test_second_claim_for_the_same_expiry_reports_a_lost_claim(self):
        membership = self.create_membership()
        claim_member_for_reminder(membership, membership.end_date)

        self.assertIs(claim_member_for_reminder(membership, membership.end_date), CLAIM_LOST)

    def test_lost_claim_is_distinguishable_from_a_null_previous_value(self):
        # None means "won it, there was no previous value"; CLAIM_LOST means
        # "did not win". Conflating them is what the sentinel exists to prevent.
        membership = self.create_membership()
        won = claim_member_for_reminder(membership, membership.end_date)
        lost = claim_member_for_reminder(membership, membership.end_date)

        self.assertIsNone(won)
        self.assertIsNotNone(lost)
        self.assertIsNot(lost, None)

    def test_claim_does_not_match_a_row_whose_expiry_moved(self):
        membership = self.create_membership()
        stale_expiry = membership.end_date
        Membership.objects.filter(pk=membership.pk).update(
            end_date=stale_expiry + timedelta(days=30)
        )

        self.assertIs(claim_member_for_reminder(membership, stale_expiry), CLAIM_LOST)

    def test_claim_then_release_round_trips_a_null_previous_value(self):
        membership = self.create_membership(expiry_reminder_for=None)

        previous = claim_member_for_reminder(membership, membership.end_date)
        self.assertEqual(self.stored_expiry(membership), membership.end_date)

        release_member_claim(membership, membership.end_date, previous)

        self.assertIsNone(self.stored_expiry(membership))
        # Released means retryable, so the next run can claim it again.
        self.assertIsNone(claim_member_for_reminder(membership, membership.end_date))

    def test_claim_then_release_round_trips_an_older_cycle_date(self):
        membership = self.create_membership(expiry_reminder_for=self.PREVIOUS_CYCLE)

        previous = claim_member_for_reminder(membership, membership.end_date)
        self.assertEqual(self.stored_expiry(membership), membership.end_date)

        release_member_claim(membership, membership.end_date, previous)

        # The older cycle date is restored, not wiped to NULL.
        self.assertEqual(self.stored_expiry(membership), self.PREVIOUS_CYCLE)
        self.assertEqual(
            claim_member_for_reminder(membership, membership.end_date), self.PREVIOUS_CYCLE
        )

    def test_release_targets_only_the_expiry_it_claims(self):
        # Release cannot tell which call wrote the value, because the value is
        # identical either way. What it does guarantee is that it only ever
        # undoes a claim for the expiry it is handed, so a release aimed at a
        # different expiry leaves the real claim alone.
        membership = self.create_membership()
        claim_member_for_reminder(membership, membership.end_date)

        release_member_claim(membership, self.TODAY + timedelta(days=99), None)

        self.assertEqual(self.stored_expiry(membership), membership.end_date)

    def test_lost_claim_must_be_handled_by_the_caller(self):
        # The sentinel is the only signal that a claim was not won. A caller
        # that ignores it and releases anyway un-does the winning claim, which
        # is why the command checks CLAIM_LOST and skips before releasing.
        membership = self.create_membership()
        claim_member_for_reminder(membership, membership.end_date)
        self.assertIs(claim_member_for_reminder(membership, membership.end_date), CLAIM_LOST)

        # The caller that follows the API contract does not call release here.
        self.assertEqual(self.stored_expiry(membership), membership.end_date)

    def test_release_of_a_stale_claim_value_changes_nothing(self):
        membership = self.create_membership()
        claim_member_for_reminder(membership, membership.end_date)

        release_member_claim(membership, self.TODAY + timedelta(days=99), None)

        self.assertEqual(self.stored_expiry(membership), membership.end_date)

    def test_repeated_release_is_idempotent(self):
        membership = self.create_membership(expiry_reminder_for=self.PREVIOUS_CYCLE)
        previous = claim_member_for_reminder(membership, membership.end_date)

        release_member_claim(membership, membership.end_date, previous)
        release_member_claim(membership, membership.end_date, previous)

        self.assertEqual(self.stored_expiry(membership), self.PREVIOUS_CYCLE)


class MembershipReminderRunClaimTests(TestCase):
    """A second run for the same expiry sends nothing, because the claim is lost."""

    TODAY = date(2026, 6, 1)

    def create_membership(self, **overrides):
        """Create a membership eligible for a reminder."""
        values = {
            "first_name_encrypted": "Maya",
            "last_name_encrypted": "Chen",
            "email_encrypted": "member@example.test",
            "membership_type": "individual",
            "status": "active",
            "end_date": date.today() + timedelta(days=7),
            "reference_id": "MEM-RUN",
            "notes": "",
        }
        values.update(overrides)
        return Membership.objects.create(**values)

    @override_settings(MEMBERSHIP_REMINDERS_ENABLED=True)
    def test_second_run_loses_the_claim_and_sends_nothing(self):
        membership = self.create_membership()

        # emails.services imported get_provider directly, so the patch has to
        # target that module's name rather than the provider package.
        with patch("emails.services.get_provider") as provider:
            first = run_membership_expiry_reminders()
            second = run_membership_expiry_reminders()

        self.assertEqual(first.sent, 1)
        self.assertEqual(first.failed, 0)
        # The second run finds the expiry already reminded, so it has no
        # candidates at all and sends nothing.
        self.assertEqual(second.sent, 0)
        self.assertEqual(provider.return_value.send_email.call_count, 1)
        membership.refresh_from_db()
        self.assertEqual(membership.expiry_reminder_for, membership.end_date)


class MembershipReminderRunTests(TestCase):
    """The shared run service: sending, failing, retrying and reporting."""

    def create_membership(self, **overrides):
        """Create a membership eligible for a reminder today."""
        values = {
            "first_name_encrypted": "Maya",
            "last_name_encrypted": "Chen",
            "email_encrypted": "member@example.test",
            "membership_type": "individual",
            "status": "active",
            "end_date": date.today() + timedelta(days=7),
            "reference_id": "MEM-RUN-TESTS",
            "notes": "",
        }
        values.update(overrides)
        return Membership.objects.create(**values)

    def patch_provider(self):
        """Patch the provider factory the shared mailer actually resolves."""
        return patch("emails.services.get_provider")

    @override_settings(MEMBERSHIP_REMINDERS_ENABLED=True)
    def test_a_run_sends_one_reminder_and_marks_the_member(self):
        membership = self.create_membership()

        with self.patch_provider() as provider:
            tally = run_membership_expiry_reminders()

        self.assertEqual(tally.sent, 1)
        self.assertEqual(tally.failed, 0)
        self.assertFalse(tally.aborted)
        provider.return_value.send_email.assert_called_once()
        membership.refresh_from_db()
        self.assertEqual(membership.expiry_reminder_for, membership.end_date)

    @override_settings(MEMBERSHIP_REMINDERS_ENABLED=True)
    def test_the_sent_message_carries_the_renew_link(self):
        self.create_membership()

        with self.patch_provider() as provider:
            run_membership_expiry_reminders()

        payload = provider.return_value.send_email.call_args.kwargs
        self.assertEqual(payload["to"], "member@example.test")
        self.assertIn("expires soon", payload["subject"])
        self.assertIn("/en/membership", payload["html"])

    @override_settings(MEMBERSHIP_REMINDERS_ENABLED=True)
    def test_a_provider_failure_leaves_the_member_unmarked_and_continues(self):
        first = self.create_membership(reference_id="MEM-FAIL-1")
        second = self.create_membership(
            email_encrypted="second@example.test", reference_id="MEM-OK-2"
        )

        with self.patch_provider() as provider:
            provider.return_value.send_email.side_effect = [
                ProviderError("provider-internal-detail"),
                None,
            ]
            tally = run_membership_expiry_reminders()

        self.assertEqual(tally.sent, 1)
        self.assertEqual(tally.failed, 1)
        first.refresh_from_db()
        second.refresh_from_db()
        # The failed member is left eligible so the next run retries them.
        self.assertIsNone(first.expiry_reminder_for)
        self.assertEqual(second.expiry_reminder_for, second.end_date)

    @override_settings(MEMBERSHIP_REMINDERS_ENABLED=True)
    def test_a_build_failure_has_nothing_to_release(self):
        membership = self.create_membership()

        with patch(
            "emails.messages.build_membership_expiry_reminder",
            side_effect=RuntimeError("template blew up"),
        ):
            tally = run_membership_expiry_reminders()

        self.assertEqual(tally.sent, 0)
        self.assertEqual(tally.failed, 1)
        membership.refresh_from_db()
        # Nothing was claimed, so no claim is left behind for the next run.
        self.assertIsNone(membership.expiry_reminder_for)

    @override_settings(MEMBERSHIP_REMINDERS_ENABLED=True)
    def test_a_send_failure_after_a_claim_restores_a_null_previous_value(self):
        membership = self.create_membership(expiry_reminder_for=None)

        with self.patch_provider() as provider:
            provider.return_value.send_email.side_effect = ProviderError("down")
            tally = run_membership_expiry_reminders()

        self.assertEqual(tally.failed, 1)
        membership.refresh_from_db()
        self.assertIsNone(membership.expiry_reminder_for)

    @override_settings(MEMBERSHIP_REMINDERS_ENABLED=True)
    def test_a_send_failure_after_a_claim_restores_an_older_cycle_date(self):
        previous_cycle = date.today() - timedelta(days=365)
        membership = self.create_membership(expiry_reminder_for=previous_cycle)

        with self.patch_provider() as provider:
            provider.return_value.send_email.side_effect = ProviderError("down")
            run_membership_expiry_reminders()

        membership.refresh_from_db()
        # The older date is restored, not wiped to NULL.
        self.assertEqual(membership.expiry_reminder_for, previous_cycle)

    @override_settings(MEMBERSHIP_REMINDERS_ENABLED=True)
    def test_a_lost_claim_is_skipped_without_releasing_it(self):
        membership = self.create_membership()
        # Another run already holds this expiry.
        claim_member_for_reminder(membership, membership.end_date)
        membership.refresh_from_db()

        with self.patch_provider() as provider:
            tally = run_membership_expiry_reminders()

        self.assertEqual(tally.sent, 0)
        self.assertEqual(tally.failed, 0)
        provider.return_value.send_email.assert_not_called()
        membership.refresh_from_db()
        # The other run's claim is untouched.
        self.assertEqual(membership.expiry_reminder_for, membership.end_date)

    @override_settings(MEMBERSHIP_REMINDERS_ENABLED=True)
    def test_running_twice_sends_exactly_one_email_per_member(self):
        self.create_membership(reference_id="MEM-ONCE-1")
        self.create_membership(
            email_encrypted="second@example.test", reference_id="MEM-ONCE-2"
        )

        with self.patch_provider() as provider:
            first = run_membership_expiry_reminders()
            second = run_membership_expiry_reminders()

        self.assertEqual(first.sent, 2)
        self.assertEqual(second.sent, 0)
        self.assertEqual(provider.return_value.send_email.call_count, 2)

    @override_settings(MEMBERSHIP_REMINDERS_ENABLED=True)
    def test_dry_run_sends_claims_and_marks_nothing(self):
        membership = self.create_membership()
        self.create_membership(email_encrypted="", reference_id="MEM-BLANK-ADDR")

        with self.patch_provider() as provider:
            tally = run_membership_expiry_reminders(dry_run=True)

        self.assertEqual(tally.sent, 0)
        self.assertEqual(tally.failed, 0)
        self.assertEqual(tally.would_remind, [membership.pk])
        self.assertEqual(tally.skipped, 1)
        provider.return_value.send_email.assert_not_called()
        membership.refresh_from_db()
        self.assertIsNone(membership.expiry_reminder_for)

    @override_settings(MEMBERSHIP_REMINDERS_ENABLED=False)
    def test_dry_run_works_while_the_feature_flag_is_off(self):
        membership = self.create_membership()

        with self.patch_provider() as provider:
            tally = run_membership_expiry_reminders(dry_run=True)

        self.assertFalse(tally.disabled)
        self.assertEqual(tally.would_remind, [membership.pk])
        provider.return_value.send_email.assert_not_called()

    @override_settings(MEMBERSHIP_REMINDERS_ENABLED=False)
    def test_a_real_run_is_disabled_and_sends_nothing(self):
        membership = self.create_membership()

        with self.patch_provider() as provider:
            tally = run_membership_expiry_reminders()

        self.assertTrue(tally.disabled)
        self.assertEqual(tally.sent, 0)
        self.assertEqual(tally.would_remind, [])
        provider.return_value.send_email.assert_not_called()
        membership.refresh_from_db()
        self.assertIsNone(membership.expiry_reminder_for)

    @override_settings(MEMBERSHIP_REMINDERS_ENABLED=True)
    def test_limit_is_applied_after_the_guard_and_sets_limit_reached(self):
        for index in range(3):
            self.create_membership(
                email_encrypted=f"member{index}@example.test",
                reference_id=f"MEM-LIMIT-{index}",
                end_date=date.today() + timedelta(days=index + 1),
            )
        # Not eligible, so it must not consume one of the limited slots.
        self.create_membership(status="canceled", reference_id="MEM-NOT-ELIGIBLE")

        with self.patch_provider() as provider:
            tally = run_membership_expiry_reminders(limit=2)

        self.assertEqual(tally.sent, 2)
        self.assertEqual(tally.limit, 2)
        self.assertTrue(tally.limit_reached)
        self.assertEqual(provider.return_value.send_email.call_count, 2)

    @override_settings(MEMBERSHIP_REMINDERS_ENABLED=True)
    def test_limit_is_not_reached_when_every_eligible_member_is_sent(self):
        self.create_membership()

        with self.patch_provider():
            tally = run_membership_expiry_reminders(limit=5)

        self.assertEqual(tally.sent, 1)
        self.assertFalse(tally.limit_reached)

    @override_settings(MEMBERSHIP_REMINDERS_ENABLED=True)
    def test_five_consecutive_failures_abort_the_run_and_release_claims(self):
        members = [
            self.create_membership(
                email_encrypted=f"member{index}@example.test",
                reference_id=f"MEM-BREAK-{index}",
                end_date=date.today() + timedelta(days=index + 1),
            )
            for index in range(6)
        ]

        with self.patch_provider() as provider:
            provider.return_value.send_email.side_effect = ProviderError("down")
            tally = run_membership_expiry_reminders()

        self.assertTrue(tally.aborted)
        self.assertEqual(tally.failed, 5)
        self.assertEqual(tally.sent, 0)
        # Aborted after five, so the sixth was never attempted.
        self.assertEqual(provider.return_value.send_email.call_count, 5)
        for member in members:
            member.refresh_from_db()
            self.assertIsNone(member.expiry_reminder_for)

    @override_settings(MEMBERSHIP_REMINDERS_ENABLED=True)
    def test_a_success_resets_the_consecutive_failure_counter(self):
        # Four failures, one success, then five more failures must be needed to
        # abort: the counter resets on success, so this run is not aborted.
        for index in range(4):
            self.create_membership(
                email_encrypted=f"fail{index}@example.test",
                reference_id=f"MEM-RESET-F{index}",
                end_date=date.today() + timedelta(days=index + 1),
            )
        self.create_membership(
            email_encrypted="good@example.test",
            reference_id="MEM-RESET-OK",
            end_date=date.today() + timedelta(days=5),
        )
        for index in range(4):
            self.create_membership(
                email_encrypted=f"fail2-{index}@example.test",
                reference_id=f"MEM-RESET-F2-{index}",
                end_date=date.today() + timedelta(days=index + 6),
            )

        with self.patch_provider() as provider:
            provider.return_value.send_email.side_effect = [
                ProviderError("down"), ProviderError("down"),
                ProviderError("down"), ProviderError("down"),
                None,
                ProviderError("down"), ProviderError("down"),
                ProviderError("down"), ProviderError("down"),
            ]
            tally = run_membership_expiry_reminders()

        # Only four consecutive failures after the success, so no abort.
        self.assertFalse(tally.aborted)
        self.assertEqual(tally.sent, 1)
        self.assertEqual(tally.failed, 8)

    @override_settings(MEMBERSHIP_REMINDERS_ENABLED=True)
    def test_the_reminder_runs_own_logs_carry_no_address_or_provider_text(self):
        # Scope: only the donations.membership_reminders logger. The shared
        # mailer logs "Email send failed for %s: %s" with the recipient and the
        # provider's text; that is a known leak in emails/services.py, outside
        # this story, and tracked separately. This test does not assert on it.
        self.create_membership(email_encrypted="secret-member@example.test")

        with self.patch_provider() as provider:
            provider.return_value.send_email.side_effect = ProviderError(
                "provider-internal-detail"
            )
            with self.assertLogs("donations.membership_reminders", level="ERROR") as logs:
                tally = run_membership_expiry_reminders()

        joined = "\n".join(logs.output)
        self.assertEqual(tally.failed, 1)
        self.assertNotIn("secret-member@example.test", joined)
        self.assertNotIn("provider-internal-detail", joined)
        # The exception class is what a developer needs, and nothing more.
        self.assertIn("ProviderError", joined)


class CreateTestMembershipCommandTests(TestCase):
    """The test-data command produces a member the selector actually picks up."""

    def run_command(self, **options):
        """Run the test-data command and return its stdout."""
        from io import StringIO

        from django.core.management import call_command

        out = StringIO()
        call_command("create_test_membership", stdout=out, **options)
        return out.getvalue()

    def test_created_member_is_selected_by_the_reminder(self):
        output = self.run_command()

        membership = Membership.objects.get()
        self.assertEqual(membership.status, "active")
        # Same clock as the selector: the project's TIME_ZONE, not the host's.
        self.assertEqual(
            membership.end_date, timezone.localdate() + timedelta(days=10)
        )
        self.assertIsNone(membership.expiry_reminder_for)

        selection = select_members_due_for_reminder()
        self.assertEqual([m.pk for m in selection.members], [membership.pk])
        self.assertEqual(selection.skipped, 0)
        self.assertIn("expiring", output)

    def test_days_and_email_can_be_overridden(self):
        self.run_command(email="other@example.test", days=3)

        membership = Membership.objects.get()
        self.assertEqual(membership.email_encrypted, "other@example.test")
        self.assertEqual(
            membership.end_date, timezone.localdate() + timedelta(days=3)
        )

    def test_a_member_outside_the_window_is_not_selected(self):
        self.run_command(days=60)

        # Proves the window, not just the command, decides eligibility.
        self.assertEqual(select_members_due_for_reminder().members, [])


class DeleteTestMembershipsCommandTests(TestCase):
    """Cleanup removes only the rows the test-data command created."""

    def run_command(self, *args, **options):
        """Run a management command and return its stdout."""
        from io import StringIO

        from django.core.management import call_command

        out = StringIO()
        call_command(*args, stdout=out, **options)
        return out.getvalue()

    def test_created_memberships_are_deleted(self):
        self.run_command("create_test_membership")
        self.run_command("create_test_membership", email="second@example.test")
        self.assertEqual(Membership.objects.count(), 2)

        output = self.run_command("delete_test_memberships")

        self.assertEqual(Membership.objects.count(), 0)
        self.assertIn("Deleted 2 test membership(s).", output)

    def test_dry_run_lists_without_deleting(self):
        self.run_command("create_test_membership")

        output = self.run_command("delete_test_memberships", dry_run=True)

        self.assertEqual(Membership.objects.count(), 1)
        self.assertIn("would be deleted", output)

    def test_a_real_membership_is_never_deleted(self):
        self.run_command("create_test_membership")
        # Same address, but created the way an admin record would be, so the
        # reference prefix is the only thing separating them.
        Membership.objects.create(
            first_name_encrypted="Real",
            last_name_encrypted="Member",
            email_encrypted="test-member@example.test",
            membership_type="individual",
            status="active",
            reference_id="MEM-MANUAL-00000001",
            notes="",
        )

        self.run_command("delete_test_memberships")

        remaining = Membership.objects.get()
        self.assertEqual(remaining.reference_id, "MEM-MANUAL-00000001")

    def test_email_filter_deletes_only_that_address(self):
        self.run_command("create_test_membership")
        self.run_command("create_test_membership", email="remove@example.test")

        self.run_command("delete_test_memberships", email="remove@example.test")

        # The filter narrows the deletion, so the other test row survives.
        remaining = Membership.objects.get()
        self.assertEqual(remaining.email_encrypted, "test-member@example.test")

    def test_nothing_to_delete_reports_cleanly(self):
        output = self.run_command("delete_test_memberships")

        self.assertIn("No test memberships found", output)
    """The trigger endpoint is key-protected and reports the run tally as JSON."""

    url = "/api/trigger/membership-reminders/"

    def setUp(self):
        self.client = APIClient()

    def create_membership(self, **overrides):
        """Create a membership eligible for a reminder today."""
        values = {
            "first_name_encrypted": "Maya",
            "last_name_encrypted": "Chen",
            "email_encrypted": "member@example.test",
            "membership_type": "individual",
            "status": "active",
            "end_date": date.today() + timedelta(days=7),
            "reference_id": "MEM-ENDPOINT",
            "notes": "",
        }
        values.update(overrides)
        return Membership.objects.create(**values)

    @override_settings(TRIGGER_API_KEY="correct-key", MEMBERSHIP_REMINDERS_ENABLED=True)
    def test_missing_api_key_is_rejected(self):
        response = self.client.post(self.url)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "Unauthorized"})

    @override_settings(TRIGGER_API_KEY="correct-key", MEMBERSHIP_REMINDERS_ENABLED=True)
    def test_wrong_api_key_is_rejected(self):
        response = self.client.post(self.url, HTTP_X_API_KEY="wrong-key")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": "Unauthorized"})

    @override_settings(TRIGGER_API_KEY="correct-key", MEMBERSHIP_REMINDERS_ENABLED=True)
    def test_get_is_not_allowed(self):
        response = self.client.get(self.url, HTTP_X_API_KEY="correct-key")

        self.assertEqual(response.status_code, 405)

    @override_settings(TRIGGER_API_KEY="correct-key", MEMBERSHIP_REMINDERS_ENABLED=True)
    def test_the_correct_key_returns_the_run_tally(self):
        membership = self.create_membership()

        with patch("emails.services.get_provider"):
            response = self.client.post(self.url, HTTP_X_API_KEY="correct-key")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "sent": 1,
            "skipped": 0,
            "failed": 0,
            "limit": 50,
            "limit_reached": False,
            "disabled": False,
            "aborted": False,
            "would_remind_count": 0,
        })
        membership.refresh_from_db()
        self.assertEqual(membership.expiry_reminder_for, membership.end_date)

    @override_settings(TRIGGER_API_KEY="correct-key", MEMBERSHIP_REMINDERS_ENABLED=True)
    def test_the_endpoint_tally_matches_the_command_run(self):
        self.create_membership()
        self.create_membership(email_encrypted="", reference_id="MEM-ENDPOINT-BLANK")

        with patch("emails.services.get_provider"):
            service_tally = run_membership_expiry_reminders()
        with patch("emails.services.get_provider"):
            response = self.client.post(self.url, HTTP_X_API_KEY="correct-key")

        # The second run has nothing left to send, which is the point: the
        # endpoint reports the same shape and the claim prevents a duplicate.
        self.assertEqual(response.json()["sent"], 0)
        self.assertEqual(response.json()["skipped"], service_tally.skipped)

    @override_settings(TRIGGER_API_KEY="correct-key", MEMBERSHIP_REMINDERS_ENABLED=False)
    def test_the_endpoint_reports_the_feature_as_disabled(self):
        self.create_membership()

        with patch("emails.services.get_provider") as provider:
            response = self.client.post(self.url, HTTP_X_API_KEY="correct-key")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["disabled"])
        self.assertEqual(response.json()["sent"], 0)
        provider.return_value.send_email.assert_not_called()

    @override_settings(TRIGGER_API_KEY="correct-key", MEMBERSHIP_REMINDERS_ENABLED=True)
    def test_a_client_cannot_pass_a_dry_run_or_extended_limit(self):
        membership = self.create_membership()

        with patch("emails.services.get_provider") as provider:
            # The endpoint ignores request data entirely, so this neither
            # previews nor escapes the default send cap.
            response = self.client.post(
                self.url,
                {"dry_run": True, "limit": 100000},
                HTTP_X_API_KEY="correct-key",
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["limit"], 50)
        self.assertEqual(response.json()["would_remind_count"], 0)
        self.assertEqual(response.json()["sent"], 1)
        provider.return_value.send_email.assert_called_once()
        membership.refresh_from_db()
        self.assertEqual(membership.expiry_reminder_for, membership.end_date)

    @override_settings(TRIGGER_API_KEY="correct-key", MEMBERSHIP_REMINDERS_ENABLED=True)
    def test_the_response_never_carries_record_identifiers(self):
        self.create_membership()

        with patch("emails.services.get_provider"):
            response = self.client.post(self.url, HTTP_X_API_KEY="correct-key")

        body = response.json()
        # A list of primary keys must never be exposed over HTTP; the response
        # carries counters and booleans only.
        self.assertNotIn("would_remind", body)
        self.assertIn("would_remind_count", body)
        self.assertNotIn("member@example.test", str(body))
        for value in body.values():
            with self.subTest(value=value):
                self.assertNotIsInstance(value, list)
