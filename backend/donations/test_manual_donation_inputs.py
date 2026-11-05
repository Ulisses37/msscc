from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase

from donations.models import Donation
from donations.serializers import ManualDonationInputSerializer


class ManualDonationInputTests(TestCase):
    """Validate received donation facts without saving or using public checkout defaults."""

    def serializer(self, **overrides):
        """Build an input with only the required known financial facts."""
        data = {"amount": "35.00", "donation_date": "1990-01-02"}
        data.update(overrides)
        return ManualDonationInputSerializer(data=data)

    def test_minimum_facts_preserve_unknown_contacts_without_implying_anonymity(self):
        serializer = self.serializer()
        self.assertTrue(serializer.is_valid(), serializer.errors)
        facts = serializer.validated_data
        self.assertEqual(facts["amount"], Decimal("35.00"))
        self.assertEqual(facts["donation_date"], date(1990, 1, 2))
        self.assertEqual(facts["currency"], "usd")
        self.assertFalse(facts["is_anonymous"])
        for field in (
            "donor_first_name_encrypted", "donor_last_name_encrypted",
            "donor_email_encrypted", "donor_address_encrypted", "payment_method",
        ):
            self.assertIsNone(facts[field])
        self.assertEqual(facts["external_reference"], "")
        self.assertEqual(facts["message"], "")
        self.assertEqual(Donation.objects.count(), 0)

    def test_amount_and_date_are_required_without_defaults(self):
        for field in ("amount", "donation_date"):
            data = {"amount": "35.00", "donation_date": "1990-01-02"}
            del data[field]
            serializer = ManualDonationInputSerializer(data=data)
            self.assertFalse(serializer.is_valid())
            self.assertIn(field, serializer.errors)

    def test_amount_rejects_unknown_zero_negative_excess_precision_and_overflow(self):
        for amount in (None, "", " ", "0", "0.00", "-0.01", "1.001",
                       "100000000.00", "NaN", "Infinity", True):
            with self.subTest(amount=amount):
                serializer = self.serializer(amount=amount)
                self.assertFalse(serializer.is_valid())
                self.assertIn("amount", serializer.errors)
        for amount in ("0.01", "35", "99999999.99"):
            serializer = self.serializer(amount=amount)
            self.assertTrue(serializer.is_valid(), serializer.errors)

    @patch("donations.serializers.timezone.localdate", return_value=date(2026, 11, 4))
    def test_valid_calendar_dates_cannot_be_future_received_payments(self, localdate):
        for value in (None, "", "2025-02-29", "0000-01-01", "2020-13-01",
                      "not-a-date", "2026-11-05", "2026-11-04T00:00:00Z"):
            with self.subTest(value=value):
                serializer = self.serializer(donation_date=value)
                self.assertFalse(serializer.is_valid())
                self.assertIn("donation_date", serializer.errors)
        for value in ("2024-02-29", "2026-11-04"):
            serializer = self.serializer(donation_date=value)
            self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_optional_contact_blanks_normalize_and_supplied_text_is_preserved(self):
        for field, stored in (
            ("donor_first_name", "donor_first_name_encrypted"),
            ("donor_last_name", "donor_last_name_encrypted"),
            ("donor_email", "donor_email_encrypted"),
            ("address", "donor_address_encrypted"),
        ):
            for value in (None, "", " \n "):
                with self.subTest(field=field, value=value):
                    serializer = self.serializer(**{field: value})
                    self.assertTrue(serializer.is_valid(), serializer.errors)
                    self.assertIsNone(serializer.validated_data[stored])
        serializer = self.serializer(
            donor_first_name=" 松山 ", donor_last_name=" O'Neil ",
            donor_email=" DONOR@EXAMPLE.TEST ", address=" 123 Example Street\n松山市 ",
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["donor_first_name_encrypted"], "松山")
        self.assertEqual(serializer.validated_data["donor_last_name_encrypted"], "O'Neil")
        self.assertEqual(serializer.validated_data["donor_email_encrypted"], "donor@example.test")
        self.assertEqual(serializer.validated_data["donor_address_encrypted"],
                         "123 Example Street\n松山市")

    def test_invalid_contacts_and_overlong_optional_text_are_rejected(self):
        for field, value in (
            ("donor_email", "invalid"), ("donor_email", "a" * 250 + "@example.test"),
            ("donor_first_name", "a" * 256), ("donor_last_name", "a" * 256),
            ("address", 123), ("donor_first_name", 123),
            ("external_reference", "a" * 256), ("message", "a" * 501),
        ):
            with self.subTest(field=field):
                serializer = self.serializer(**{field: value})
                self.assertFalse(serializer.is_valid())
                self.assertIn(field, serializer.errors)

    def test_anonymous_input_discards_names_and_address_but_retains_optional_email(self):
        serializer = self.serializer(
            is_anonymous=True, donor_first_name="Forged", donor_last_name="Identity",
            address="Private address", donor_email=" DONOR@EXAMPLE.TEST ",
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        for field in ("donor_first_name_encrypted", "donor_last_name_encrypted",
                      "donor_address_encrypted"):
            self.assertIsNone(serializer.validated_data[field])
        self.assertEqual(serializer.validated_data["donor_email_encrypted"], "donor@example.test")
        for value in ("true", 1, None):
            serializer = self.serializer(is_anonymous=value)
            self.assertFalse(serializer.is_valid())
            self.assertIn("is_anonymous", serializer.errors)
        serializer = self.serializer(is_anonymous=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertIsNone(serializer.validated_data["donor_email_encrypted"])

    def test_payment_method_and_external_reference_remain_independent(self):
        for method in (None, "cash", "check"):
            serializer = self.serializer(
                payment_method=method, external_reference=" check mentioned here ",
                message=" Historical note ",
            )
            self.assertTrue(serializer.is_valid(), serializer.errors)
            self.assertEqual(serializer.validated_data["payment_method"], method)
            self.assertEqual(
                serializer.validated_data["external_reference"], "check mentioned here",
            )
            self.assertEqual(serializer.validated_data["message"], "Historical note")
        for method in ("", "unknown", "card", "unsupported"):
            serializer = self.serializer(payment_method=method)
            self.assertFalse(serializer.is_valid())
            self.assertIn("payment_method", serializer.errors)

    def test_currency_and_server_controlled_checkout_fields_are_rejected(self):
        serializer = self.serializer(currency="jpy")
        self.assertFalse(serializer.is_valid())
        self.assertIn("currency", serializer.errors)
        for field, value in (
            ("record_source", "checkout"), ("payment_status", "pending"),
            ("reference_id", "DON-00000001"), ("stripe_payment_intent_id", "forged"),
            ("stripe_checkout_session_id", "forged"), ("completed_at", "1990-01-02"),
            ("receipt_sent_at", "1990-01-02"), ("contribute_to_processing_costs", True),
            ("processing_cost_contribution", "1.00"), ("total_amount", "36.00"),
            ("donor_email_encrypted", "forged@example.test"),
        ):
            with self.subTest(field=field):
                serializer = self.serializer(**{field: value})
                self.assertFalse(serializer.is_valid())
                self.assertIn(field, serializer.errors)
