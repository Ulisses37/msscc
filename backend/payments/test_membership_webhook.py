"""Focused SCRUM-675 checks; broader lifecycle coverage belongs to SCRUM-676."""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from unittest.mock import Mock, patch

from django.db import DatabaseError
from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory

from donations.models import Membership
from donations.services import _annual_renewal_date
from payments.views import StripeWebhookView


@override_settings(STRIPE_WEBHOOK_SECRET="whsec_test")
class MembershipWebhookTests(TestCase):
    """Exercise the signed webhook route with a pending, linked checkout."""

    def setUp(self):
        self.factory = APIRequestFactory()
        # These dates satisfy legacy required fields; they are not paid time.
        self.member = Membership.objects.create(
            first_name="Maya", last_name="Chen", email="maya@example.com", phone="",
            membership_type="student", membership_option_id="student", amount_paid=0,
            expected_amount=Decimal("20.00"), currency="usd", start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 1), renewal_date=date(2025, 1, 1),
            payment_status=Membership.PaymentStatus.PENDING, status="pending",
            reference_id="MEM-" + "a" * 32, checkout_reference="MEM-" + "a" * 32,
            stripe_payment_intent_id="pi_membership_test", notes="",
        )

    def send(self, event_type="payment_intent.succeeded", *, created=None, **overrides):
        # Match the intent state to the event; failed/canceled events are not
        # successful payments, even if they use the same checkout reference.
        intent_status = {
            "payment_intent.succeeded": "succeeded",
            "payment_intent.payment_failed": "requires_payment_method",
            "payment_intent.canceled": "canceled",
        }.get(event_type, "processing")
        intent = {
            "id": "pi_membership_test", "status": intent_status,
            "amount_received": 2000 if intent_status == "succeeded" else 0,
            "currency": "usd", "metadata": {
                "payment_purpose": "membership",
                "internal_reference": self.member.checkout_reference,
            },
        }
        intent.update(overrides)
        event = Mock()
        event.to_dict.return_value = {
            "id": "evt_membership_test", "type": event_type,
            "created": (created if created is not None else
                        int(datetime(2025, 3, 1, 12, tzinfo=UTC).timestamp())),
            "data": {"object": intent},
        }
        request = self.factory.post(
            "/api/payments/webhook/", b"{}", content_type="application/json",
            HTTP_STRIPE_SIGNATURE="sig_test",
        )
        with patch("payments.views.stripe.Webhook.construct_event", return_value=event):
            return StripeWebhookView.as_view()(request)

    def test_verified_success_activates_for_one_year_once(self):
        # Processing long after the event must not grant extra membership time.
        self.assertEqual(self.send().status_code, 200)
        self.member.refresh_from_db()
        self.assertEqual(self.member.payment_status, Membership.PaymentStatus.COMPLETED)
        self.assertEqual(self.member.status, "active")
        self.assertEqual(self.member.amount_paid, Decimal("20.00"))
        self.assertEqual(self.member.start_date, date(2025, 3, 1))
        self.assertEqual(self.member.renewal_date, date(2026, 3, 1))
        self.assertEqual(self.member.end_date, self.member.renewal_date - timedelta(days=1))
        # A duplicate delivery must not update timestamps or reset the term.
        saved = (self.member.start_date, self.member.end_date, self.member.updated_at)
        self.assertEqual(self.send().status_code, 200)
        self.member.refresh_from_db()
        self.assertEqual(
            saved, (self.member.start_date, self.member.end_date, self.member.updated_at)
        )
        self.assertEqual(self.send("payment_intent.payment_failed").status_code, 200)
        self.member.refresh_from_db()
        self.assertEqual(self.member.payment_status, Membership.PaymentStatus.COMPLETED)
        self.assertEqual(Membership.objects.count(), 1)

    def test_annual_anniversary_handles_leap_day(self):
        # The next anniversary falls on February 28 when February 29 is absent.
        self.assertEqual(_annual_renewal_date(date(2024, 2, 29)), date(2025, 2, 28))
        self.assertEqual(_annual_renewal_date(date(2025, 10, 10)), date(2026, 10, 10))

    def test_failures_and_cancellation_do_not_activate(self):
        # A failure followed by cancellation can update payment status, but
        # neither outcome should confer membership time or an amount paid.
        for event_type, expected in (
            ("payment_intent.payment_failed", Membership.PaymentStatus.FAILED),
            ("payment_intent.canceled", Membership.PaymentStatus.CANCELED),
        ):
            self.assertEqual(self.send(event_type).status_code, 200)
            self.member.refresh_from_db()
            self.assertEqual(self.member.payment_status, expected)
            self.assertEqual(self.member.status, "pending")
            self.assertEqual(self.member.amount_paid, 0)

    def test_mismatches_cannot_activate(self):
        # Check both the stored intent/reference linkage and paid amount/state.
        for changes in (
            {"id": "pi_wrong"}, {"amount_received": 1999},
            {"currency": "eur"}, {"status": "processing"},
            {"amount_received": None}, {"amount_received": True},
            {"metadata": {
                "payment_purpose": "membership", "internal_reference": "MEM-" + "b" * 32,
            }},
        ):
            with self.subTest(changes=changes):
                self.send(**changes)
                self.member.refresh_from_db()
                self.assertEqual(self.member.payment_status, Membership.PaymentStatus.PENDING)
                self.assertEqual(self.member.status, "pending")

    def test_invalid_payment_event_dates_cannot_activate(self):
        # An unusable signed timestamp must not silently fall back to today.
        for created in (False, "not-a-timestamp", -1, 10**30):
            with self.subTest(created=created):
                self.assertEqual(self.send(created=created).status_code, 200)
                self.member.refresh_from_db()
                self.assertEqual(self.member.payment_status, Membership.PaymentStatus.PENDING)
                self.assertEqual(self.member.status, "pending")

    def test_unverified_event_does_not_touch_member(self):
        # Missing signature is rejected before any event can reach the service.
        request = self.factory.post(
            "/api/payments/webhook/", b"{}", content_type="application/json"
        )
        self.assertEqual(StripeWebhookView.as_view()(request).status_code, 400)
        self.member.refresh_from_db()
        self.assertEqual(self.member.status, "pending")

    @patch(
        "payments.views.update_membership_from_payment_intent",
        side_effect=DatabaseError("private"),
    )
    def test_database_failure_is_retryable_and_safe(self, update):
        # Stripe must be able to retry without seeing private exception text.
        with self.assertLogs("payments.views", level="ERROR") as logs:
            response = self.send()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private", str(response.data) + str(logs.output))
        update.assert_called_once()
