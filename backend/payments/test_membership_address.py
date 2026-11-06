from unittest.mock import patch

from django.db import models
from django.db.models.functions import Cast
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from config.encryption import EncryptedTextError, decrypt_text, is_encrypted_text
from donations.models import Membership
from donations.services import update_membership_from_payment_intent


@override_settings(STRIPE_SECRET_KEY="sk_test_dummy")
class MembershipAddressTests(TestCase):
    """Keep public checkout addresses encrypted and outside payment disclosures."""

    def setUp(self):
        self.client = APIClient()
        self.address = "123 Example Street\n松山市, 日本"

    def checkout_data(self, **overrides):
        """Build a valid checkout request with only the tested field varied."""
        return {
            "membership_option_id": "student", "payment_purpose": "membership",
            "first_name": "Maya", "last_name": "Chen", "email": "maya@example.test",
            "address": self.address, **overrides,
        }

    def stored_address(self, member):
        """Inspect ciphertext without running the encrypted field's read conversion."""
        return Membership.objects.annotate(
            stored_address=Cast("address_encrypted", output_field=models.TextField()),
        ).values_list("stored_address", flat=True).get(pk=member.pk)

    @patch("donations.services.create_membership_payment_intent")
    def test_missing_blank_null_and_non_text_addresses_are_field_errors(self, create_intent):
        missing = self.checkout_data()
        missing.pop("address")
        invalid = [missing] + [
            self.checkout_data(address=value)
            for value in ("", " \t\r\n ", None, 123, True, [], {})
        ]
        for data in invalid:
            with self.subTest(data=data):
                response = self.client.post(
                    "/api/payments/membership/session/", data, format="json",
                )
                self.assertEqual(response.status_code, 400)
                self.assertEqual(set(response.data), {"address"})
        create_intent.assert_not_called()
        self.assertFalse(Membership.objects.exists())

    @patch("payments.services.stripe_service.StripeClient")
    def test_checkout_and_completion_preserve_ciphertext_without_disclosure(self, stripe_client):
        intent = stripe_client.return_value.v1.payment_intents.create.return_value
        intent.id = "pi_test_address"
        intent.client_secret = "test-client-secret"
        with self.assertNoLogs("payments", level="DEBUG"):
            with self.assertNoLogs("donations", level="DEBUG"):
                response = self.client.post(
                    "/api/payments/membership/session/",
                    self.checkout_data(address=f"  {self.address}\n  "), format="json",
                )
        self.assertEqual(response.status_code, 201)
        member = Membership.objects.get()
        self.assertEqual(member.address_encrypted, self.address)
        ciphertext = self.stored_address(member)
        self.assertTrue(is_encrypted_text(ciphertext))
        self.assertNotEqual(ciphertext, self.address)
        self.assertEqual(decrypt_text(ciphertext), self.address)
        params = stripe_client.return_value.v1.payment_intents.create.call_args.args[0]
        self.assertEqual(set(params["metadata"]), {
            "payment_purpose", "membership_option_id", "internal_reference",
        })
        self.assertNotIn(self.address, str(params))
        self.assertNotIn("address", str(params))
        self.assertNotIn(self.address, str(response.data))
        self.assertNotIn("address", response.data)

        # Activation and public reads have no reason to decrypt or rewrite contact data.
        with patch("config.fields.decrypt_text", side_effect=AssertionError("Unexpected PII")):
            self.assertTrue(update_membership_from_payment_intent(
                reference=member.checkout_reference, intent_id=intent.id,
                event_type="payment_intent.succeeded", event_created=1792584000,
                intent={"status": "succeeded", "amount_received": 2000, "currency": "usd"},
            ))
            for url in ("/api/payments/membership/status/", "/api/payments/receipt/"):
                public = self.client.get(url, {
                    "confirmation_reference": member.checkout_reference,
                })
                self.assertEqual(public.status_code, 200)
                self.assertNotIn(self.address, str(public.data))
                self.assertNotIn("address", public.data)
                self.assertNotIn("address_encrypted", public.data)
        member.refresh_from_db()
        self.assertEqual(member.payment_status, Membership.PaymentStatus.COMPLETED)
        self.assertEqual(member.address_encrypted, self.address)
        self.assertEqual(self.stored_address(member), ciphertext)

    @patch("donations.services.create_membership_payment_intent")
    def test_address_encryption_failure_is_safe_and_does_not_start_payment(self, create_intent):
        from config.fields import encrypt_text

        def fail_address(value):
            if value == self.address:
                raise EncryptedTextError(self.address)
            return encrypt_text(value)

        with patch("config.fields.encrypt_text", side_effect=fail_address):
            with self.assertLogs("payments.views", level="ERROR") as logs:
                response = self.client.post(
                    "/api/payments/membership/session/", self.checkout_data(), format="json",
                )
        self.assertEqual(response.status_code, 502)
        self.assertNotIn(self.address, str(response.data) + str(logs.output))
        self.assertTrue(all(record.exc_info is None for record in logs.records))
        self.assertFalse(Membership.objects.exists())
        create_intent.assert_not_called()
