from contextlib import ExitStack
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import DatabaseError, IntegrityError, models, transaction
from django.db.models.functions import Cast
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from config.encryption import EncryptedTextError, decrypt_text
from donations.manual_donations import create_manual_donation
from donations.models import Donation
from donations.serializers import ManualDonationInputSerializer
from emails.models import Subscriber
from payments.views import _is_donation_reference, _update_donation_payment_status


class ManualDonationCreationTests(TestCase):
    """Secure received-donation creation without checkout or subscription side effects."""

    url = "/api/donations/manual/"

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="finance@example.test", permissions_data={"Finances": True},
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def donation_data(self, **overrides):
        """Return known financial facts without fabricated historical contacts."""
        return {"amount": "35.00", "donation_date": "1990-01-02", **overrides}

    def test_unauthorized_requests_never_reach_creation(self):
        for permissions in ({}, {"Finances": False}, {"Finances": "true"}, {"Finances": 1}):
            self.user.permissions_data = permissions
            with patch("donations.views.create_manual_donation") as create:
                response = self.client.post(self.url, self.donation_data(), format="json")
            self.assertEqual(response.status_code, 403)
            create.assert_not_called()
        self.user.permissions_data = {"Finances": True}
        self.user.is_active = False
        response = self.client.post(self.url, self.donation_data(), format="json")
        self.assertEqual(response.status_code, 403)
        self.client.force_authenticate(user=None)
        response = self.client.post(self.url, self.donation_data(), format="json")
        self.assertEqual(response.status_code, 401)
        self.assertFalse(Donation.objects.exists())

    def test_financial_admin_and_executive_create_completed_received_records(self):
        for executive in (False, True):
            self.user.is_executive = executive
            self.user.permissions_data = {} if executive else {"Finances": True}
            response = self.client.post(self.url, self.donation_data(), format="json")
            self.assertEqual(response.status_code, 201, response.data)
            record = Donation.objects.get(pk=response.data["donation_id"])
            self.assertEqual(record.record_source, "manual")
            self.assertEqual(record.payment_status, "completed")
            self.assertEqual(record.donation_date, date(1990, 1, 2))
            self.assertEqual(record.amount, Decimal("35.00"))
            self.assertEqual(record.total_amount, record.amount)
            self.assertEqual(record.processing_cost_contribution, Decimal("0.00"))
            self.assertFalse(record.contribute_to_processing_costs)
            self.assertFalse(record.is_anonymous)
            for field in (
                "donor_first_name_encrypted", "donor_last_name_encrypted",
                "donor_email_encrypted", "donor_address_encrypted", "payment_method",
                "completed_at", "receipt_sent_at",
            ):
                self.assertIsNone(getattr(record, field))
            self.assertEqual(response.data["record_source"], "manual")
            self.assertEqual(response.data["currency"], "usd")
        self.assertEqual(Donation.objects.count(), 2)

    def test_reusable_service_and_endpoint_share_validation(self):
        for overrides in (
            {"amount": "0"}, {"donation_date": "2025-02-29"}, {"donor_email": "invalid"},
            {"payment_method": "unsupported"}, {"donation_date": "9999-12-31"},
        ):
            with self.subTest(overrides=overrides):
                with self.assertRaises(ValidationError):
                    create_manual_donation(self.donation_data(**overrides))
                response = self.client.post(
                    self.url, self.donation_data(**overrides), format="json",
                )
                self.assertEqual(response.status_code, 400)
        self.assertFalse(Donation.objects.exists())
        record = create_manual_donation(self.donation_data(payment_method="cash"))
        self.assertEqual(record.payment_method, "cash")
        self.assertEqual(record.record_source, "manual")

    def test_references_and_payment_methods_are_independent_of_checkout(self):
        for method in (None, "cash", "check", "card", "bank_transfer"):
            response = self.client.post(self.url, self.donation_data(
                payment_method=method, external_reference=" DON-00000001 cash/check ",
            ), format="json")
            self.assertEqual(response.status_code, 201, response.data)
            record = Donation.objects.get(pk=response.data["donation_id"])
            self.assertEqual(record.reference_id, f"DON-MANUAL-{record.pk:08d}")
            self.assertEqual(record.external_reference, "DON-00000001 cash/check")
            self.assertEqual(record.payment_method, method)
            self.assertFalse(_is_donation_reference(record.reference_id))
            with self.assertRaises(ValueError):
                _update_donation_payment_status(record.reference_id, "completed")
            session = APIClient().post("/api/payments/session/", {
                "internal_reference": record.reference_id, "amount": "35.00",
                "currency": "usd", "payment_purpose": "Donation",
            }, format="json")
            self.assertEqual(session.status_code, 400)

    def test_contacts_are_encrypted_and_available_only_to_authorized_reads(self):
        supplied = {
            "donor_first_name": " Maya ", "donor_last_name": " 松山 ",
            "donor_email": " DONOR@EXAMPLE.TEST ", "address": " 123 Example Street\n松山市 ",
        }
        response = self.client.post(self.url, self.donation_data(**supplied), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        record = Donation.objects.get(pk=response.data["donation_id"])
        for public, stored in (
            ("donor_first_name", "donor_first_name_encrypted"),
            ("donor_last_name", "donor_last_name_encrypted"),
            ("donor_email", "donor_email_encrypted"), ("address", "donor_address_encrypted"),
        ):
            expected = supplied[public].strip()
            if public == "donor_email":
                expected = expected.lower()
            raw = Donation.objects.annotate(raw=Cast(stored, models.TextField())).values_list(
                "raw", flat=True,
            ).get(pk=record.pk)
            self.assertNotEqual(raw, expected)
            self.assertEqual(decrypt_text(raw), expected)
            self.assertEqual(response.data[public], expected)
        url = f"/api/donations/{record.pk}/"
        self.assertEqual(self.client.get(url).data["record_source"], "manual")
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(url).status_code, 401)

    def test_anonymous_forged_identity_is_not_retained(self):
        response = self.client.post(self.url, self.donation_data(
            is_anonymous=True, donor_first_name="Forged", donor_last_name="Identity",
            address="Private address", donor_email=" DONOR@EXAMPLE.TEST ",
        ), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        record = Donation.objects.get(pk=response.data["donation_id"])
        for field in (
            "donor_first_name_encrypted", "donor_last_name_encrypted", "donor_address_encrypted",
        ):
            self.assertIsNone(getattr(record, field))
        self.assertEqual(record.donor_email_encrypted, "donor@example.test")
        self.assertNotIn("Forged", str(response.data))
        self.assertNotIn("Private address", str(response.data))

    def test_checkout_and_server_controlled_fields_are_rejected_before_creation(self):
        for field, value in (
            ("record_source", "checkout"), ("payment_status", "pending"),
            ("stripe_payment_intent_id", "forged"), ("stripe_checkout_session_id", "forged"),
            ("reference_id", "DON-00000001"), ("completed_at", "1990-01-02"),
            ("receipt_sent_at", "1990-01-02"), ("contribute_to_processing_costs", True),
            ("processing_cost_contribution", "1.00"), ("total_amount", "36.00"),
        ):
            response = self.client.post(
                self.url, self.donation_data(**{field: value}), format="json",
            )
            self.assertEqual(response.status_code, 400)
            self.assertIn(field, response.data)
        self.assertFalse(Donation.objects.exists())

    def test_serializer_save_kwargs_cannot_override_controlled_facts_or_anonymity(self):
        serializer = ManualDonationInputSerializer(data=self.donation_data(is_anonymous=True))
        self.assertTrue(serializer.is_valid(), serializer.errors)
        record = serializer.save(
            record_source="checkout", payment_status="pending", total_amount=Decimal("999"),
            contribute_to_processing_costs=True, processing_cost_contribution=Decimal("99"),
            completed_at=timezone.now(), receipt_sent_at=timezone.now(),
            reference_id="DON-00000001", donor_first_name_encrypted="Forged",
            donor_address_encrypted="Private address",
        )
        self.assertEqual(record.record_source, "manual")
        self.assertEqual(record.payment_status, "completed")
        self.assertEqual(record.total_amount, Decimal("35.00"))
        self.assertEqual(record.processing_cost_contribution, Decimal("0.00"))
        self.assertFalse(record.contribute_to_processing_costs)
        self.assertIsNone(record.completed_at)
        self.assertIsNone(record.receipt_sent_at)
        self.assertIsNone(record.donor_first_name_encrypted)
        self.assertIsNone(record.donor_address_encrypted)
        self.assertTrue(record.reference_id.startswith("DON-MANUAL-"))

    def test_reference_assignment_failure_rolls_back_api_and_service(self):
        original = Donation.save

        def fail_reference(record, *args, **kwargs):
            if kwargs.get("update_fields") == ["reference_id"]:
                raise DatabaseError("private-database-detail")
            return original(record, *args, **kwargs)

        with patch.object(Donation, "save", fail_reference):
            response = self.client.post(self.url, self.donation_data(), format="json")
            self.assertEqual(response.status_code, 503)
            self.assertNotIn("private-database-detail", str(response.data))
            with self.assertRaises(DatabaseError):
                create_manual_donation(self.donation_data())
        self.assertFalse(Donation.objects.exists())

    def test_encryption_failure_returns_safe_error_and_rolls_back(self):
        with patch("config.fields.encrypt_text", side_effect=EncryptedTextError("private-detail")):
            response = self.client.post(self.url, self.donation_data(
                donor_email="donor@example.test",
            ), format="json")
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private-detail", str(response.data))
        self.assertFalse(Donation.objects.exists())

    def test_no_payment_receipt_or_subscription_actions_including_on_commit(self):
        subscriber = Subscriber.objects.create(email="donor@example.test", status="unsubscribed")
        before = list(Subscriber.objects.order_by("pk").values())
        targets = (
            "payments.views.create_payment_session",
            "payments.services.stripe_service.create_payment_session",
            "payments.views.send_donation_receipt", "donations.receipts.send_donation_receipt",
            "donations.receipts.send_email",
            "emails.services.send_email", "emails.subscribers.subscribe_contact",
            "emails.views.subscribe_contact", "emails.subscribers.get_provider",
            "emails.services.get_provider",
        )
        with ExitStack() as stack:
            mocks = [stack.enter_context(patch(target)) for target in targets]
            with self.captureOnCommitCallbacks(execute=True) as callbacks:
                for email in (subscriber.email, "new-contact@example.test"):
                    with self.subTest(email=email):
                        values = self.donation_data(donor_email=email, payment_method="check")
                        response = self.client.post(self.url, values, format="json")
                        self.assertEqual(response.status_code, 201, response.data)
                        create_manual_donation(values)
                        self.assertEqual(
                            list(Subscriber.objects.order_by("pk").values()), before,
                        )
            self.assertEqual(callbacks, [])
            for mock in mocks:
                mock.assert_not_called()
        self.assertEqual(list(Subscriber.objects.order_by("pk").values()), before)

    def test_admin_metadata_is_read_only_on_existing_record(self):
        record = create_manual_donation(self.donation_data(
            donor_first_name="Maya", donor_last_name="松山", donor_email="donor@example.test",
            payment_method="cash", external_reference="original",
        ))
        response = self.client.patch(f"/api/donations/{record.pk}/", {
            "record_source": "checkout", "payment_method": "check",
            "external_reference": "replacement", "currency": "jpy",
        }, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        record.refresh_from_db()
        self.assertEqual(record.record_source, "manual")
        self.assertEqual(record.payment_method, "cash")
        self.assertEqual(record.external_reference, "original")
        self.assertEqual(record.currency, "usd")

    def test_matching_identity_creates_separate_record_without_updating_original(self):
        original = create_manual_donation(self.donation_data(
            donor_first_name="Maya", donor_last_name="Donor", donor_email="donor@example.test",
            payment_method="cash", external_reference="original",
        ))
        before = Donation.objects.filter(pk=original.pk).values().get()
        response = self.client.post(self.url, self.donation_data(
            donor_first_name="Maya", donor_last_name="Donor", donor_email="donor@example.test",
            amount="50.00", payment_method="check", external_reference="separate",
        ), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertNotEqual(response.data["donation_id"], original.pk)
        self.assertEqual(Donation.objects.count(), 2)
        self.assertEqual(Donation.objects.filter(pk=original.pk).values().get(), before)
        saved = self.client.get(f"/api/donations/{response.data['donation_id']}/")
        self.assertEqual(saved.status_code, 200, saved.data)
        self.assertEqual(saved.data["amount"], "50.00")
        self.assertEqual(saved.data["payment_method"], "check")
        self.assertEqual(saved.data["external_reference"], "separate")

    def test_database_constraints_reject_unsupported_origin_and_method(self):
        record = create_manual_donation(self.donation_data())
        for field in ("record_source", "payment_method"):
            with self.assertRaises(IntegrityError), transaction.atomic():
                Donation.objects.filter(pk=record.pk).update(**{field: "unsupported"})

    def test_public_creation_remains_pending_and_checkout_compatible(self):
        response = APIClient().post("/api/donations/", {
            "donor_first_name": "Public", "donor_last_name": "Donor",
            "donor_email": "public@example.test", "address": "Public address",
            "amount": "12.50", "contribute_to_processing_costs": True,
            "record_source": "manual", "payment_method": "cash",
            "external_reference": "not-for-public", "donation_date": "1990-01-02",
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        record = Donation.objects.get(pk=response.data["donation_id"])
        self.assertEqual(record.record_source, "checkout")
        self.assertEqual(record.payment_status, "pending")
        self.assertEqual(record.donation_date, timezone.localdate())
        self.assertTrue(_is_donation_reference(record.reference_id))
        self.assertIsNone(record.payment_method)
        self.assertEqual(record.external_reference, "")
        self.assertEqual(record.processing_cost_contribution, Decimal("0.68"))
        self.assertEqual(record.total_amount, Decimal("13.18"))
        for field in ("record_source", "payment_method", "external_reference", "currency"):
            self.assertNotIn(field, response.data)
