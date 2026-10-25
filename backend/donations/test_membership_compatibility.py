from datetime import UTC, date, datetime
from decimal import Decimal
from unittest.mock import Mock, patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models
from django.db.models.functions import Cast
from django.test import TestCase
from rest_framework.test import APIClient

from config.encryption import EncryptedTextError
from donations.models import Membership, MembershipAnnualHistory


class MembershipCompatibilityTests(TestCase):
    """Exercise legacy identity, annual history, and checkout together without inference."""

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="finance@example.test", permissions_data={"Finances": True},
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.member = Membership.objects.create(
            first_name_encrypted="Maya 松山", last_name_encrypted="O'Connor",
            email_encrypted="maya@example.test", phone_encrypted="555-0100",
            address_encrypted="123 Private Street\n日本", membership_type="historical",
            status="active", notes="Original notes", reference_id="legacy-reference",
            record_source="legacy_import",
        )
        self.url = f"/api/donations/memberships/{self.member.pk}/"

    def snapshot(self):
        """Capture every business field and original identity ciphertext."""
        return Membership.objects.annotate(**{
            f"stored_{field}": Cast(field, output_field=models.TextField())
            for field in (
                "first_name_encrypted", "last_name_encrypted", "email_encrypted",
                "phone_encrypted", "address_encrypted",
            )
        }).values().get(pk=self.member.pk)

    def test_non_null_values_round_trip_without_reinterpreting_dues_or_status(self):
        values = {
            "membership_price": "35.25", "amount_paid": "12.50",
            "payment_status": "paid by check", "start_date": "2020-01-01",
            "end_date": "2020-12-31", "renewal_date": "2021-01-01",
        }
        response = self.client.patch(self.url, values, format="json")
        self.assertEqual(response.status_code, 200)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        for field, expected in {
            **values, "first_name": self.member.first_name_encrypted,
            "last_name": self.member.last_name_encrypted, "email": self.member.email_encrypted,
            "phone": self.member.phone_encrypted, "address": self.member.address_encrypted,
            "record_source": "legacy_import", "notes": "Original notes",
            "reference_id": "legacy-reference", "status": "active",
        }.items():
            self.assertEqual(response.data[field], expected, field)

    def test_annual_history_does_not_infer_unknown_dates_or_payments(self):
        before = self.snapshot()
        history = MembershipAnnualHistory.objects.create(
            membership=self.member, year=2022, is_active=True,
        )
        history.is_active = False
        history.save()
        self.assertEqual(self.snapshot(), before)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        for field in (
            "amount_paid", "membership_price", "payment_status", "start_date",
            "end_date", "renewal_date",
        ):
            self.assertIsNone(response.data[field])

    @patch("donations.services.create_membership_payment_intent")
    def test_verified_checkout_preserves_unrelated_legacy_records_and_history(self, create_intent):
        create_intent.return_value = {"session_id": "pi_test_compatibility"}
        history = MembershipAnnualHistory.objects.create(
            membership=self.member, year=2022, is_active=True,
        )
        before = self.snapshot()
        history_before = MembershipAnnualHistory.objects.values().get(pk=history.pk)
        public = APIClient()
        response = public.post("/api/payments/membership/session/", {
            "first_name": "Alex", "last_name": "Rivera", "email": "alex@example.test",
            "membership_option_id": "student", "payment_purpose": "membership",
            "contribute_to_processing_costs": True,
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        checkout = Membership.objects.get(
            checkout_reference=response.data["confirmation_reference"],
        )
        self.assertEqual(checkout.record_source, "checkout")
        self.assertEqual(checkout.membership_price, Decimal("20.00"))
        self.assertEqual(checkout.expected_amount, Decimal("20.91"))
        self.assertEqual(checkout.amount_paid, Decimal("0.00"))
        self.assertEqual(checkout.payment_status, "pending")
        for field in ("start_date", "end_date", "renewal_date", "completed_at"):
            self.assertIsNone(getattr(checkout, field))
        self.assertFalse(checkout.annual_history.exists())
        event = Mock()
        event.to_dict.return_value = {
            "id": "evt_test_compatibility", "type": "payment_intent.succeeded",
            "created": int(datetime(2026, 1, 15, 12, tzinfo=UTC).timestamp()),
            "data": {"object": {
                "id": checkout.stripe_payment_intent_id, "status": "succeeded",
                "amount_received": 2091, "currency": "usd",
                "metadata": {
                    "payment_purpose": "membership",
                    "internal_reference": checkout.checkout_reference,
                },
            }},
        }
        with patch("payments.views.stripe.Webhook.construct_event", return_value=event):
            for _ in range(2):
                response = public.post(
                    "/api/payments/webhook/", {}, format="json", HTTP_STRIPE_SIGNATURE="sig_test",
                )
                self.assertEqual(response.status_code, 200, response.data)
        checkout.refresh_from_db()
        self.assertEqual(checkout.payment_status, "completed")
        self.assertEqual(checkout.status, "active")
        self.assertEqual(checkout.amount_paid, Decimal("20.91"))
        self.assertEqual(checkout.membership_price, Decimal("20.00"))
        self.assertEqual(checkout.record_source, "checkout")
        self.assertEqual(checkout.start_date, date(2026, 1, 15))
        self.assertEqual(checkout.end_date, date(2027, 1, 14))
        self.assertEqual(checkout.renewal_date, date(2027, 1, 15))
        self.assertEqual(self.snapshot(), before)
        self.assertEqual(
            MembershipAnnualHistory.objects.values().get(pk=history.pk), history_before,
        )
        self.assertFalse(checkout.annual_history.exists())
        self.assertEqual(Membership.objects.count(), 2)

    def test_encryption_failures_never_log_or_return_combined_sensitive_values(self):
        before = self.snapshot()
        sensitive = (
            self.member.first_name_encrypted, self.member.last_name_encrypted,
            self.member.email_encrypted, self.member.phone_encrypted,
            self.member.address_encrypted, "private-exception-detail",
            *settings.FIELD_ENCRYPTION_KEYS,
            *(value for field, value in before.items() if field.startswith("stored_")),
        )
        for operation in ("read", "write"):
            target = (
                "config.fields.decrypt_text"
                if operation == "read" else "config.fields.encrypt_text"
            )
            with self.subTest(operation=operation), patch(
                target, side_effect=EncryptedTextError("private-exception-detail"),
            ):
                with self.assertLogs("donations.views", level="ERROR") as logs:
                    response = (
                        self.client.get(self.url) if operation == "read"
                        else self.client.patch(self.url, {"notes": "Edited"}, format="json")
                    )
                self.assertEqual(response.status_code, 503)
                self.assertEqual(response.data, {
                    "detail": "Record processing is temporarily unavailable.",
                })
                exposed = str(response.data) + str(logs.output)
                for value in sensitive:
                    self.assertNotIn(value, exposed)
                self.assertTrue(all(record.exc_info is None for record in logs.records))
            self.assertEqual(self.snapshot(), before)
