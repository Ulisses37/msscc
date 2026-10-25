from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.db import IntegrityError, models, transaction
from django.db.models.functions import Cast
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from config.encryption import decrypt_text, is_encrypted_text
from donations.models import Membership
from donations.serializers import MembershipSerializer
from donations.services import create_pending_membership, update_membership_from_payment_intent
from payments.views import MembershipPaymentStatusView, PaymentReceiptView


class MembershipLegacyFieldsTests(TestCase):
    """Keep unknown historical facts distinct from known payment and membership data."""

    def create_membership(self, **overrides):
        """Create a valid historical identity without inventing dates or payments."""
        data = {
            "first_name_encrypted": "Maya",
            "last_name_encrypted": "Chen",
            "membership_type": "individual",
            "status": "active",
            "reference_id": "historical-reference",
            "notes": "Historical membership",
            "record_source": Membership.RecordSource.LEGACY_IMPORT,
        }
        data.update(overrides)
        return Membership.objects.create(**data)

    def test_unknown_facts_remain_null_through_validation_and_save(self):
        member = self.create_membership()
        member.full_clean()
        member.refresh_from_db()
        for field in (
            "email_encrypted", "phone_encrypted", "address_encrypted", "start_date",
            "end_date", "renewal_date", "amount_paid", "membership_price", "payment_status",
        ):
            with self.subTest(field=field):
                self.assertIsNone(getattr(member, field))
        self.assertEqual(member.status, "active")
        self.assertEqual(member.record_source, Membership.RecordSource.LEGACY_IMPORT)

    def test_known_zero_and_free_text_payment_status_remain_valid(self):
        member = self.create_membership(amount_paid=Decimal("0.00"), payment_status="waived")
        member.full_clean()
        member.refresh_from_db()
        self.assertEqual(member.amount_paid, Decimal("0.00"))
        self.assertEqual(member.payment_status, "waived")

    def test_membership_price_is_independent_of_amount_paid(self):
        member = self.create_membership(membership_price=Decimal("35.25"))
        member.full_clean()
        member.refresh_from_db()
        self.assertEqual(member.membership_price, Decimal("35.25"))
        self.assertIsNone(member.amount_paid)

    def test_membership_price_rejects_excess_precision_and_size(self):
        for value in (Decimal("35.251"), Decimal("100000000.00")):
            with self.subTest(value=value):
                member = Membership(
                    membership_type="individual", status="active", reference_id="test",
                    notes="Historical", membership_price=value,
                )
                with self.assertRaises(ValidationError) as caught:
                    member.full_clean()
                self.assertIn("membership_price", caught.exception.message_dict)

    def test_address_is_ciphertext_in_storage_and_plaintext_through_orm(self):
        address = "123 Example Street\n松山市, 日本"
        member = self.create_membership(address_encrypted=address)
        ciphertext = Membership.objects.annotate(
            stored_address=Cast("address_encrypted", output_field=models.TextField()),
        ).values_list("stored_address", flat=True).get(pk=member.pk)
        self.assertTrue(is_encrypted_text(ciphertext))
        self.assertNotIn(address, ciphertext)
        self.assertEqual(decrypt_text(ciphertext), address)
        member.refresh_from_db()
        self.assertEqual(member.address_encrypted, address)
        self.assertEqual(MembershipSerializer(member).data["address"], address)
        self.assertNotIn("address_encrypted", MembershipSerializer(member).data)

    def test_default_source_is_manual_and_all_sources_validate(self):
        self.assertEqual(Membership().record_source, Membership.RecordSource.MANUAL)
        for source in Membership.RecordSource.values:
            with self.subTest(source=source):
                self.create_membership(record_source=source).full_clean()

    def test_invalid_source_is_rejected_by_validation_and_database(self):
        member = self.create_membership()
        member.record_source = "untrusted"
        with self.assertRaises(ValidationError) as caught:
            member.full_clean()
        self.assertIn("record_source", caught.exception.message_dict)
        for source in ("untrusted", "", None):
            with self.subTest(source=source):
                with self.assertRaises(IntegrityError), transaction.atomic():
                    Membership.objects.filter(pk=member.pk).update(record_source=source)

    def test_null_payment_status_is_not_mapped_to_a_public_payment_state(self):
        member = self.create_membership(
            checkout_reference="MEM-" + "a" * 32,
            stripe_payment_intent_id="pi_test_unknown",
        )
        request = APIRequestFactory().get(
            "/api/payments/membership/status/",
            {"confirmation_reference": member.checkout_reference},
        )
        with self.assertLogs("payments.views", level="ERROR"):
            response = MembershipPaymentStatusView.as_view()(request)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data, {"detail": "Payment status is temporarily unavailable."})
        member.refresh_from_db()
        self.assertIsNone(member.payment_status)

    @patch("donations.services.create_membership_payment_intent")
    def test_checkout_sets_known_facts_and_webhook_establishes_actual_dates(self, create_intent):
        create_intent.return_value = {"session_id": "pi_test_legacy_schema"}
        result = create_pending_membership(
            option_id="student", first_name="Maya", last_name="Chen",
            email="maya@example.test", contribute_to_processing_costs=True,
        )
        member = Membership.objects.get(checkout_reference=result["confirmation_reference"])
        self.assertEqual(member.record_source, Membership.RecordSource.CHECKOUT)
        self.assertEqual(member.membership_price, Decimal("20.00"))
        self.assertEqual(member.base_amount, Decimal("20.00"))
        self.assertEqual(member.expected_amount, Decimal("20.91"))
        self.assertEqual(member.amount_paid, Decimal("0.00"))
        self.assertEqual(member.payment_status, Membership.PaymentStatus.PENDING)
        for field in ("start_date", "end_date", "renewal_date", "completed_at"):
            self.assertIsNone(getattr(member, field))

        # Payment code must not decrypt an address it has no reason to access.
        with patch("config.fields.decrypt_text", side_effect=AssertionError("Unexpected PII")):
            changed = update_membership_from_payment_intent(
                reference=member.checkout_reference, intent_id=member.stripe_payment_intent_id,
                event_type="payment_intent.succeeded",
                intent={"status": "succeeded", "amount_received": 2091, "currency": "usd"},
                event_created=int(datetime(2026, 1, 15, 12, tzinfo=UTC).timestamp()),
            )
            receipt = PaymentReceiptView.as_view()(APIRequestFactory().get(
                "/api/payments/receipt/", {"confirmation_reference": member.checkout_reference},
            ))
        self.assertTrue(changed)
        self.assertEqual(receipt.status_code, 200)
        self.assertNotIn("address", receipt.data)
        self.assertNotIn("address_encrypted", receipt.data)
        member.refresh_from_db()
        self.assertEqual(member.amount_paid, Decimal("20.91"))
        self.assertEqual(member.membership_price, Decimal("20.00"))
        self.assertEqual(member.payment_status, Membership.PaymentStatus.COMPLETED)
        self.assertIsNotNone(member.start_date)
        self.assertIsNotNone(member.end_date)
        self.assertIsNotNone(member.renewal_date)
