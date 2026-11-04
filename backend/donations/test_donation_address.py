from datetime import UTC, datetime
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import models
from django.db.models.functions import Cast
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from config.encryption import EncryptedTextError, decrypt_text, encrypt_text, is_encrypted_text
from donations.models import Donation
from donations.serializers import DonationSerializer


class DonationAddressTests(TestCase):
    """Verify public address requirements independently of historical financial records."""

    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            email="finance@example.test", permissions_data={"Finances": True},
        )
        self.address = "123 Example Street\n松山市, 日本"

    def donation_data(self, **overrides):
        """Build a valid public donation request with only the tested fields varied."""
        return {
            "donor_first_name": "Maya", "donor_last_name": "Chen",
            "donor_email": "maya@example.test", "amount": "10.00", "is_anonymous": False,
            "address": self.address, **overrides,
        }

    def create_donation(self, **overrides):
        """Create through the public contract, including when the caller is an admin."""
        response = self.client.post(
            "/api/donations/", self.donation_data(**overrides), format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return Donation.objects.get(pk=response.data["donation_id"]), response

    def stored_address(self, donation):
        """Read ciphertext without invoking encrypted-field conversion."""
        return Donation.objects.annotate(
            stored_address=Cast("donor_address_encrypted", output_field=models.TextField()),
        ).values_list("stored_address", flat=True).get(pk=donation.pk)

    def test_public_requires_nonblank_text_address_even_for_authenticated_admin(self):
        missing = self.donation_data()
        missing.pop("address")
        invalid = [missing] + [
            self.donation_data(address=value)
            for value in (None, "", " \t\r\n ", 123, True, [], {})
        ]
        for user in (None, self.user):
            self.client.force_authenticate(user=user)
            for data in invalid:
                with self.subTest(user=user, data=data):
                    response = self.client.post("/api/donations/", data, format="json")
                    self.assertEqual(response.status_code, 400)
                    self.assertEqual(set(response.data), {"address"})
                    self.assertNotIn(self.address, str(response.data))
        self.assertFalse(Donation.objects.exists())

    def test_address_is_encrypted_and_only_available_through_authorized_records(self):
        with self.assertNoLogs("donations", level="DEBUG"):
            donation, response = self.create_donation(address=f"  {self.address}\n ")
        self.assertNotIn("address", response.data)
        self.assertNotIn("donor_address_encrypted", response.data)
        self.assertNotIn(self.address, str(response.data))
        self.assertEqual(donation.donor_address_encrypted, self.address)
        ciphertext = self.stored_address(donation)
        self.assertTrue(is_encrypted_text(ciphertext))
        self.assertNotEqual(ciphertext, self.address)
        self.assertEqual(decrypt_text(ciphertext), self.address)
        self.client.force_authenticate(user=self.user)
        for endpoint in ("/api/donations/", f"/api/donations/{donation.pk}/"):
            result = self.client.get(endpoint)
            self.assertEqual(result.status_code, 200)
            data = result.data[0] if isinstance(result.data, list) else result.data
            self.assertEqual(data["address"], self.address)
            self.assertNotIn("donor_address_encrypted", data)

    def test_anonymous_creation_and_updates_discard_supplied_addresses(self):
        donation, response = self.create_donation(is_anonymous=True)
        self.assertIsNone(donation.donor_address_encrypted)
        self.assertIsNone(self.stored_address(donation))
        self.assertNotIn(self.address, str(response.data))
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            f"/api/donations/{donation.pk}/", {"address": self.address}, format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["address"])
        ordinary, _ = self.create_donation()
        response = self.client.patch(
            f"/api/donations/{ordinary.pk}/", {"is_anonymous": True}, format="json",
        )
        self.assertEqual(response.status_code, 200)
        ordinary.refresh_from_db()
        self.assertIsNone(ordinary.donor_address_encrypted)

    def test_historical_unknown_address_and_partial_updates_remain_valid(self):
        data = self.donation_data()
        data.pop("address")
        serializer = DonationSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        donation = serializer.save()
        self.assertIsNone(donation.donor_address_encrypted)
        self.client.force_authenticate(user=self.user)
        url = f"/api/donations/{donation.pk}/"
        for change, expected in (
            ({"message": "Historical"}, None),
            ({"address": self.address}, self.address),
            ({"message": "Preserve address"}, self.address),
            ({"address": " \t "}, None),
            ({"address": None}, None),
        ):
            response = self.client.patch(url, change, format="json")
            self.assertEqual(response.status_code, 200, response.data)
            donation.refresh_from_db()
            self.assertEqual(donation.donor_address_encrypted, expected)

    def test_unauthorized_reads_are_denied_before_decryption(self):
        donation, _ = self.create_donation()
        denied = get_user_model().objects.create_user(email="denied@example.test")
        inactive = get_user_model().objects.create_user(
            email="inactive@example.test", is_active=False, permissions_data={"Finances": True},
        )
        for user, expected in ((None, 401), (denied, 403), (inactive, 403)):
            self.client.force_authenticate(user=user)
            for url in ("/api/donations/", f"/api/donations/{donation.pk}/"):
                with patch("config.fields.decrypt_text", side_effect=AssertionError("PII loaded")):
                    response = self.client.get(url)
                self.assertEqual(response.status_code, expected)
                self.assertNotIn(self.address, str(response.data))

    def test_address_encryption_failure_rolls_back_without_disclosure(self):
        def fail_address(value):
            if value == self.address:
                raise EncryptedTextError(self.address)
            return encrypt_text(value)

        with patch("config.fields.encrypt_text", side_effect=fail_address):
            with self.assertLogs("donations.views", level="ERROR") as logs:
                response = self.client.post("/api/donations/", self.donation_data(), format="json")
        self.assertEqual(response.status_code, 503)
        self.assertNotIn(self.address, str(response.data) + str(logs.output))
        self.assertTrue(all(record.exc_info is None for record in logs.records))
        self.assertFalse(Donation.objects.exists())

    @override_settings(STRIPE_SECRET_KEY="sk_test_dummy")
    @patch("payments.views.stripe.checkout.Session.retrieve")
    def test_public_status_and_receipt_do_not_decrypt_or_disclose_address(self, retrieve):
        donation, _ = self.create_donation()
        Donation.objects.filter(pk=donation.pk).update(
            payment_status="completed", completed_at=datetime(2026, 10, 21, tzinfo=UTC),
        )
        retrieve.return_value.to_dict.return_value = {
            "client_reference_id": donation.reference_id,
        }
        with patch("config.fields.decrypt_text", side_effect=AssertionError("PII loaded")):
            status = self.client.get("/api/payments/status/", {"session_id": "cs_test_address"})
            receipt = self.client.get("/api/payments/receipt/", {
                "confirmation_reference": donation.reference_id,
            })
        for response in (status, receipt):
            self.assertEqual(response.status_code, 200)
            self.assertNotIn("address", str(response.data))
            self.assertNotIn(self.address, str(response.data))

    @override_settings(STRIPE_SECRET_KEY="sk_test_dummy", FRONTEND_URL="https://example.test")
    @patch("payments.services.stripe_service.StripeClient")
    def test_checkout_metadata_never_contains_the_stored_address(self, stripe_client):
        donation, _ = self.create_donation()
        session = stripe_client.return_value.v1.checkout.sessions.create.return_value
        session.id = "cs_test_address"
        session.client_secret = "test-client-secret"
        with self.assertNoLogs("payments", level="DEBUG"):
            response = self.client.post("/api/payments/session/", {
                "amount": "10.00", "currency": "usd", "payment_purpose": "Donation",
                "internal_reference": donation.reference_id,
            }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        params = stripe_client.return_value.v1.checkout.sessions.create.call_args.args[0]
        expected = {"payment_purpose": "Donation", "internal_reference": donation.reference_id}
        self.assertEqual(params["metadata"], expected)
        self.assertEqual(params["payment_intent_data"]["metadata"], expected)
        self.assertNotIn(self.address, str(params) + str(response.data))
