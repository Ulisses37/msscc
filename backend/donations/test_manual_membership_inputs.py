from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIRequestFactory

from donations.models import Membership
from donations.serializers import ManualMembershipCreateSerializer, MembershipSerializer
from donations.views import MembershipListCreateView


class ManualMembershipInputTests(TestCase):
    """Preserve unknown manual facts while rejecting invalid supplied facts."""

    def serializer(self, **overrides):
        """Build the minimum explicitly identified manual record."""
        data = {
            "first_name": "  松山  ", "last_name": "O'Neil",
            "membership_type": "Historical lifetime", "status": "unknown",
        }
        data.update(overrides)
        return ManualMembershipCreateSerializer(data=data)

    def test_minimum_record_preserves_unknowns_after_save(self):
        serializer = self.serializer()
        self.assertTrue(serializer.is_valid(), serializer.errors)
        record = serializer.save()
        record.refresh_from_db()
        self.assertEqual(record.first_name_encrypted, "松山")
        self.assertEqual(record.membership_type, "Historical lifetime")
        self.assertEqual(record.status, "unknown")
        self.assertEqual(record.record_source, Membership.RecordSource.MANUAL)
        for field in (
            "email_encrypted", "phone_encrypted", "address_encrypted", "membership_price",
            "amount_paid", "start_date", "end_date", "renewal_date", "payment_status",
            "payment_method", "stripe_payment_intent_id", "completed_at",
        ):
            with self.subTest(field=field):
                self.assertIsNone(getattr(record, field))
        self.assertEqual(record.reference_id, "")
        self.assertEqual(record.notes, "")

    def test_required_fields_and_supported_choices(self):
        for field in ("first_name", "last_name", "membership_type", "status"):
            for value in (None, "", "   "):
                with self.subTest(field=field, value=value):
                    serializer = self.serializer(**{field: value})
                    self.assertFalse(serializer.is_valid())
                    self.assertIn(field, serializer.errors)
        for field, values in (
            ("status", ManualMembershipCreateSerializer.MEMBERSHIP_STATUSES),
            ("payment_status", (*ManualMembershipCreateSerializer.PAYMENT_STATUSES, None)),
            ("payment_method", (*Membership.PaymentMethod.values, None)),
        ):
            for value in values:
                serializer = self.serializer(**{field: value})
                self.assertTrue(serializer.is_valid(), serializer.errors)
            serializer = self.serializer(**{field: "unsupported"})
            self.assertFalse(serializer.is_valid())
            self.assertIn(field, serializer.errors)

    def test_optional_contacts_normalize_to_null_and_email_is_validated(self):
        for field in ("email", "phone", "address"):
            for value in (None, "", " \n "):
                serializer = self.serializer(**{field: value})
                self.assertTrue(serializer.is_valid(), serializer.errors)
                self.assertIsNone(serializer.validated_data[f"{field}_encrypted"])
        serializer = self.serializer(email="  MEMBER@EXAMPLE.TEST  ")
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["email_encrypted"], "member@example.test")
        serializer = self.serializer(email="invalid")
        self.assertFalse(serializer.is_valid())
        self.assertIn("email", serializer.errors)

    def test_amount_validation_and_independent_historical_prices(self):
        for field in ("membership_price", "amount_paid"):
            for value in ("-0.01", "1.001", "100000000.00", "NaN", "Infinity"):
                serializer = self.serializer(**{field: value})
                self.assertFalse(serializer.is_valid())
                self.assertIn(field, serializer.errors)
        serializer = self.serializer(membership_price="73.25", amount_paid="0.00")
        self.assertTrue(serializer.is_valid(), serializer.errors)
        record = serializer.save()
        record.refresh_from_db()
        self.assertEqual(record.membership_price, Decimal("73.25"))
        self.assertEqual(record.amount_paid, Decimal("0.00"))

    def test_dates_validate_without_inventing_missing_dates(self):
        for field in ("start_date", "end_date", "renewal_date"):
            serializer = self.serializer(**{field: "2025-02-29"})
            self.assertFalse(serializer.is_valid())
            self.assertIn(field, serializer.errors)
        serializer = self.serializer(start_date="2020-01-02", end_date="2020-01-01")
        self.assertFalse(serializer.is_valid())
        self.assertIn("end_date", serializer.errors)
        for values in (
            {"start_date": "2020-01-01"}, {"end_date": "2020-01-01"},
            {"start_date": "2020-01-01", "end_date": "2020-01-01"},
        ):
            serializer = self.serializer(**values)
            self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_offline_payment_facts_do_not_infer_method(self):
        for method in (None, "cash", "check", "bank_transfer"):
            serializer = self.serializer(
                amount_paid="35.00", payment_status="completed", payment_method=method,
                reference_id="  cash mentioned in historical text  ",
            )
            self.assertTrue(serializer.is_valid(), serializer.errors)
            record = serializer.save()
            self.assertEqual(record.payment_method, method)
            self.assertIsNone(record.stripe_payment_intent_id)
            self.assertIsNone(record.start_date)

    def test_creation_uses_strict_contract_but_reads_preserve_historical_statuses(self):
        view = MembershipListCreateView()
        view.request = APIRequestFactory().post("/")
        self.assertIs(view.get_serializer_class(), ManualMembershipCreateSerializer)
        view.request = APIRequestFactory().get("/")
        self.assertIs(view.get_serializer_class(), MembershipSerializer)
        record = Membership(payment_status="historically recorded", status="custom historical")
        self.assertEqual(
            MembershipSerializer(record).data["payment_status"], "historically recorded",
        )
