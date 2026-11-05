from contextlib import ExitStack
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import DatabaseError, models
from django.db.models.functions import Cast
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from config.encryption import EncryptedTextError, decrypt_text
from donations.manual_memberships import create_manual_membership
from donations.models import Membership, MembershipAnnualHistory
from donations.serializers import ManualMembershipCreateSerializer
from emails.models import Subscriber


class ManualMembershipCreationTests(TestCase):
    """Secure manual creation without checkout or announcement side effects."""

    url = "/api/donations/memberships/"

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="finance@example.test", permissions_data={"Finances": True},
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def membership_data(self, **overrides):
        """Return minimum manual input without invented historical facts."""
        data = {
            "first_name": "Maya", "last_name": "松山", "membership_type": "Historical lifetime",
            "status": "unknown",
        }
        data.update(overrides)
        return data

    def test_unauthorized_requests_do_not_reach_creation(self):
        for permissions in ({}, {"Finances": False}, {"Finances": "true"}, {"Finances": 1}):
            self.user.permissions_data = permissions
            with patch("donations.manual_memberships._persist_manual_membership") as persist:
                response = self.client.post(self.url, self.membership_data(), format="json")
            self.assertEqual(response.status_code, 403)
            persist.assert_not_called()
        self.user.permissions_data = {"Finances": True}
        self.user.is_active = False
        response = self.client.post(self.url, self.membership_data(), format="json")
        self.assertEqual(response.status_code, 403)
        self.client.force_authenticate(user=None)
        response = self.client.post(self.url, self.membership_data(), format="json")
        self.assertEqual(response.status_code, 401)
        self.assertFalse(Membership.objects.exists())

    def test_financial_user_and_executive_can_create(self):
        for executive in (False, True):
            self.user.is_executive = executive
            self.user.permissions_data = {} if executive else {"Finances": True}
            response = self.client.post(self.url, self.membership_data(), format="json")
            self.assertEqual(response.status_code, 201, response.data)
            self.assertEqual(response.data["record_source"], "manual")
        self.assertEqual(Membership.objects.count(), 2)

    def test_service_reuses_validation_without_request_or_checkout(self):
        for overrides in ({"email": "invalid"}, {"amount_paid": "-1"}, {"status": "invalid"}):
            with self.assertRaises(ValidationError):
                create_manual_membership(self.membership_data(**overrides))
        self.assertFalse(Membership.objects.exists())
        record = create_manual_membership(self.membership_data(email=" MEMBER@EXAMPLE.TEST "))
        self.assertEqual(record.email_encrypted, "member@example.test")
        self.assertEqual(record.record_source, "manual")

    def test_contacts_are_encrypted_in_storage(self):
        contacts = {
            "first_name": "Maya", "last_name": "松山", "email": "member@example.test",
            "phone": "+81 (89) 123-4567", "address": "123 Example Street\n日本",
        }
        response = self.client.post(self.url, self.membership_data(**contacts), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        for field, expected in contacts.items():
            stored = Membership.objects.annotate(
                ciphertext=Cast(f"{field}_encrypted", output_field=models.TextField()),
            ).values_list("ciphertext", flat=True).get(pk=response.data["membership_id"])
            self.assertTrue(stored.startswith("msscc:enc:v1:"))
            self.assertNotEqual(stored, expected)
            self.assertEqual(decrypt_text(stored), expected)
            self.assertEqual(response.data[field], expected)

    def test_clients_cannot_assign_checkout_or_server_controlled_fields(self):
        protected = {
            "record_source": "checkout", "checkout_reference": "MEM-" + "a" * 32,
            "stripe_payment_intent_id": "pi_test_untrusted", "membership_option_id": "student",
            "expected_amount": "99.00", "base_amount": "99.00", "currency": "usd",
            "contribute_to_processing_costs": True, "processing_cost_contribution": "9.00",
            "completed_at": "2020-01-01T00:00:00Z", "receipt_sent_at": "2020-01-01T00:00:00Z",
            "membership_id": 999999, "created_at": "2020-01-01T00:00:00Z",
            "updated_at": "2020-01-01T00:00:00Z", "first_name_encrypted": "Untrusted",
        }
        response = self.client.post(
            self.url, self.membership_data(**protected), format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        record = Membership.objects.get()
        self.assertEqual(record.record_source, "manual")
        self.assertEqual(record.first_name_encrypted, "Maya")
        self.assertNotEqual(record.pk, 999999)
        self.assertNotEqual(record.created_at.year, 2020)
        self.assertNotEqual(record.updated_at.year, 2020)
        for field in (
            "checkout_reference", "stripe_payment_intent_id", "membership_option_id",
            "expected_amount", "base_amount", "currency", "completed_at", "receipt_sent_at",
        ):
            self.assertIsNone(getattr(record, field), field)
        self.assertFalse(record.contribute_to_processing_costs)
        self.assertEqual(record.processing_cost_contribution, Decimal("0.00"))

    def test_serializer_save_overrides_cannot_change_origin_or_checkout_values(self):
        serializer = ManualMembershipCreateSerializer(data=self.membership_data())
        self.assertTrue(serializer.is_valid(), serializer.errors)
        record = serializer.save(
            record_source="checkout", stripe_payment_intent_id="pi_test_override",
        )
        self.assertEqual(record.record_source, "manual")
        self.assertIsNone(record.stripe_payment_intent_id)

    def test_generated_and_external_references(self):
        references = []
        for values in ({}, {"reference_id": ""}, {"reference_id": " \n "}):
            response = self.client.post(self.url, self.membership_data(**values), format="json")
            self.assertEqual(response.status_code, 201, response.data)
            reference = f"MEM-MANUAL-{response.data['membership_id']:08d}"
            self.assertEqual(response.data["reference_id"], reference)
            references.append(reference)
        self.assertEqual(len(set(references)), 3)
        record = create_manual_membership(
            self.membership_data(reference_id=" historical-check-42 "),
        )
        self.assertEqual(record.reference_id, "historical-check-42")

    def test_reference_assignment_failure_rolls_back_api_and_service_creation(self):
        original_save = Membership.save

        def fail_reference_save(instance, *args, **kwargs):
            if kwargs.get("update_fields") == ["reference_id"]:
                raise DatabaseError("internal failure")
            return original_save(instance, *args, **kwargs)

        with patch.object(Membership, "save", fail_reference_save):
            with self.assertLogs("donations.views", level="ERROR") as logs:
                response = self.client.post(self.url, self.membership_data(), format="json")
            self.assertEqual(response.status_code, 503)
            self.assertNotIn("internal failure", str(response.data) + str(logs.output))
            self.assertFalse(Membership.objects.exists())
            with self.assertRaises(DatabaseError):
                create_manual_membership(self.membership_data())
        self.assertFalse(Membership.objects.exists())

    def test_encryption_failure_rolls_back_without_exposing_details(self):
        with patch(
            "config.fields.encrypt_text", side_effect=EncryptedTextError("internal failure"),
        ):
            with self.assertLogs("donations.views", level="ERROR") as logs:
                response = self.client.post(self.url, self.membership_data(), format="json")
            self.assertEqual(response.status_code, 503)
            self.assertNotIn("internal failure", str(response.data) + str(logs.output))
            with self.assertRaises(EncryptedTextError):
                create_manual_membership(self.membership_data())
        self.assertFalse(Membership.objects.exists())

    def test_creation_has_no_payment_receipt_or_subscription_side_effects(self):
        targets = (
            "donations.services.create_membership_payment_intent",
            "payments.services.stripe_service.StripeClient",
            "donations.receipts.send_membership_receipt",
            "donations.services.send_membership_receipt",
            "emails.services.send_email", "donations.receipts.send_email",
            "emails.subscribers.subscribe_contact", "emails.providers.get_provider",
        )
        with ExitStack() as stack:
            mocks = [stack.enter_context(patch(target)) for target in targets]
            with self.captureOnCommitCallbacks(execute=True) as callbacks:
                for status in (None, *Subscriber.Status.values):
                    if status is not None:
                        Subscriber.objects.create(
                            email=f"{status}@example.test", status=status, source="footer",
                        )
                    before = list(Subscriber.objects.order_by("pk").values())
                    email = f"{status}@example.test"
                    values = self.membership_data(
                        email=email, amount_paid="35.00", payment_status="completed",
                        payment_method="check",
                    )
                    response = self.client.post(self.url, values, format="json")
                    self.assertEqual(response.status_code, 201, response.data)
                    create_manual_membership(values)
                    self.assertEqual(list(Subscriber.objects.order_by("pk").values()), before)
            self.assertEqual(callbacks, [])
            for mocked in mocks:
                mocked.assert_not_called()

    def test_historical_states_and_payment_methods_are_preserved_independently(self):
        for state in ("expired", "inactive", "unknown"):
            for method in (None, "cash", "check", "card", "bank_transfer", "other"):
                response = self.client.post(self.url, self.membership_data(
                    status=state, start_date="1990-01-01", end_date="1990-12-31",
                    amount_paid="35.00", payment_status="completed", payment_method=method,
                ), format="json")
                self.assertEqual(response.status_code, 201, response.data)
                record = Membership.objects.get(pk=response.data["membership_id"])
                self.assertEqual(record.status, state)
                self.assertEqual(record.payment_method, method)
                self.assertEqual(record.record_source, "manual")
                self.assertIsNone(record.completed_at)
                self.assertIsNone(record.renewal_date)

    def test_current_offline_payment_persists_without_checkout_or_receipt_timestamps(self):
        today = timezone.localdate()
        end = today + timedelta(days=365)
        response = self.client.post(self.url, self.membership_data(
            membership_type="individual", status="active", start_date=today.isoformat(),
            end_date=end.isoformat(), renewal_date=end.isoformat(), membership_price="35.00",
            amount_paid="35.00", payment_status="completed", payment_method="cash",
            reference_id="offline-reference", notes="Payment received offline",
        ), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        record = Membership.objects.get(pk=response.data["membership_id"])
        self.assertEqual(record.start_date, today)
        self.assertEqual(record.end_date, end)
        self.assertEqual(record.renewal_date, end)
        self.assertEqual(record.status, "active")
        self.assertEqual(record.membership_price, Decimal("35.00"))
        self.assertEqual(record.amount_paid, Decimal("35.00"))
        self.assertEqual(record.payment_status, "completed")
        self.assertEqual(record.payment_method, "cash")
        self.assertEqual(record.record_source, "manual")
        self.assertEqual(record.reference_id, "offline-reference")
        self.assertEqual(record.notes, "Payment received offline")
        self.assertIsNone(record.stripe_payment_intent_id)
        self.assertIsNone(record.completed_at)
        self.assertIsNone(record.receipt_sent_at)

    def test_matching_identity_creates_separate_record_without_changing_existing_history(self):
        existing = create_manual_membership(self.membership_data(
            email="member@example.test", start_date="1990-01-01", end_date="1990-12-31",
            status="expired", notes="Original historical facts",
        ))
        MembershipAnnualHistory.objects.create(membership=existing, year=1990, is_active=True)
        MembershipAnnualHistory.objects.create(membership=existing, year=1991, is_active=False)
        before_record = Membership.objects.filter(pk=existing.pk).values().get()
        before_history = list(MembershipAnnualHistory.objects.order_by("pk").values())

        response = self.client.post(self.url, self.membership_data(
            email="member@example.test", status="active", amount_paid="0.00",
            payment_status="waived", start_date="2026-01-01", notes="Separate manual entry",
        ), format="json")

        self.assertEqual(response.status_code, 201, response.data)
        self.assertNotEqual(response.data["membership_id"], existing.pk)
        self.assertEqual(Membership.objects.count(), 2)
        self.assertEqual(Membership.objects.filter(pk=existing.pk).values().get(), before_record)
        self.assertEqual(
            list(MembershipAnnualHistory.objects.order_by("pk").values()), before_history,
        )
        created = Membership.objects.get(pk=response.data["membership_id"])
        self.assertEqual(created.start_date, date(2026, 1, 1))
        self.assertEqual(created.amount_paid, Decimal("0.00"))
        self.assertFalse(created.annual_history.exists())
