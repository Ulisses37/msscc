from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase

from donations.models import Donation, Membership
from donations.receipts import send_donation_receipt, send_membership_receipt
from donations.services import update_membership_from_payment_intent
from payments.serializers import MEMBERSHIP_PRICES
from payments.views import _update_donation_payment_status

SEND = "donations.receipts.send_email"
EVENT_CREATED = int(datetime(2026, 10, 25, 12, 0, tzinfo=UTC).timestamp())


def make_membership(**overrides):
    option_id = next(iter(MEMBERSHIP_PRICES))
    base = MEMBERSHIP_PRICES[option_id]
    fields = dict(
        first_name_encrypted="Ada", last_name_encrypted="Lovelace",
        email_encrypted="ada@example.com",
        membership_type=option_id, membership_option_id=option_id,
        amount_paid=0, expected_amount=base, base_amount=base,
        membership_price=base, currency="usd",
        record_source=Membership.RecordSource.CHECKOUT,
        payment_status=Membership.PaymentStatus.PENDING, status="pending",
        reference_id="MEM-" + "a" * 32, checkout_reference="MEM-" + "a" * 32,
        stripe_payment_intent_id="pi_test_123", notes="",
    )
    fields.update(overrides)
    return Membership.objects.create(**fields)


def make_donation(**overrides):
    fields = dict(
        donor_first_name_encrypted="Grace", donor_last_name_encrypted="Hopper",
        donor_email_encrypted="grace@example.com",
        amount=Decimal("25.00"), total_amount=Decimal("25.00"),
        currency="usd", donation_date=datetime(2026, 10, 25).date(),
        is_anonymous=False, message="", reference_id="DON-00000001",
        payment_status=Donation.PaymentStatus.PENDING,
    )
    fields.update(overrides)
    return Donation.objects.create(**fields)


class MembershipReceiptTests(TestCase):
    def setUp(self):
        self.membership = make_membership()

    def _event(self, event_type="payment_intent.succeeded", **intent_overrides):
        intent = {
            "id": self.membership.stripe_payment_intent_id,
            "status": "succeeded",
            "amount_received": int(self.membership.expected_amount * 100),
            "currency": "usd",
        }
        intent.update(intent_overrides)
        with self.captureOnCommitCallbacks(execute=True):
            return update_membership_from_payment_intent(
                reference=self.membership.checkout_reference,
                intent_id=self.membership.stripe_payment_intent_id,
                event_type=event_type, intent=intent,
                event_created=EVENT_CREATED,
            )

    @patch(SEND)
    def test_sends_once_on_first_completion(self, send):
        self.assertTrue(self._event())
        send.assert_called_once()
        to, subject, template, context = send.call_args.args
        self.assertEqual(to, "ada@example.com")
        self.assertEqual(template, "emails/membership_receipt.html")
        self.assertEqual(context["first_name"], "Ada")
        self.assertEqual(context["reference"], self.membership.checkout_reference)

    @patch(SEND)
    def test_duplicate_event_does_not_send_again(self, send):
        self._event()
        self.assertFalse(self._event())
        send.assert_called_once()

    @patch(SEND)
    def test_failed_payment_sends_nothing(self, send):
        self._event("payment_intent.payment_failed", status="requires_payment_method")
        send.assert_not_called()

    @patch(SEND)
    def test_canceled_payment_sends_nothing(self, send):
        self._event("payment_intent.canceled", status="canceled")
        send.assert_not_called()

    @patch(SEND)
    def test_late_failure_after_completion_sends_nothing_more(self, send):
        self._event()
        self._event("payment_intent.payment_failed")
        send.assert_called_once()

    @patch(SEND)
    def test_wrong_amount_is_rejected_and_sends_nothing(self, send):
        self.assertFalse(self._event(amount_received=1))
        send.assert_not_called()

    @patch(SEND)
    def test_missing_email_skips_send(self, send):
        Membership.objects.filter(pk=self.membership.pk).update(email_encrypted="")
        self._event()
        send.assert_not_called()

    @patch(SEND, side_effect=RuntimeError("boom"))
    def test_send_failure_does_not_raise(self, send):
        # A receipt bug must never undo or fail a recorded payment.
        self.assertTrue(self._event())
        self.membership.refresh_from_db()
        self.assertEqual(self.membership.payment_status, Membership.PaymentStatus.COMPLETED)

    @patch(SEND)
    def test_receipt_function_ignores_non_completed_membership(self, send):
        send_membership_receipt(self.membership.pk)
        send.assert_not_called()


class DonationReceiptTests(TestCase):
    def setUp(self):
        self.donation = make_donation()

    def _update(self, new_status):
        with self.captureOnCommitCallbacks(execute=True):
            return _update_donation_payment_status(self.donation.reference_id, new_status)

    @patch(SEND)
    def test_sends_once_on_first_completion(self, send):
        self.assertTrue(self._update(Donation.PaymentStatus.COMPLETED))
        send.assert_called_once()
        to, subject, template, context = send.call_args.args
        self.assertEqual(to, "grace@example.com")
        self.assertEqual(template, "emails/donation_receipt.html")
        self.assertEqual(context["first_name"], "Grace")
        self.assertEqual(context["total_amount"], "$25.00")

    @patch(SEND)
    def test_duplicate_event_does_not_send_again(self, send):
        self._update(Donation.PaymentStatus.COMPLETED)
        self.assertFalse(self._update(Donation.PaymentStatus.COMPLETED))
        send.assert_called_once()

    @patch(SEND)
    def test_failed_and_canceled_send_nothing(self, send):
        self._update(Donation.PaymentStatus.FAILED)
        self._update(Donation.PaymentStatus.CANCELED)
        send.assert_not_called()

    @patch(SEND)
    def test_late_failure_after_completion_sends_nothing_more(self, send):
        self._update(Donation.PaymentStatus.COMPLETED)
        self._update(Donation.PaymentStatus.FAILED)
        send.assert_called_once()

    @patch(SEND)
    def test_missing_email_skips_send(self, send):
        Donation.objects.filter(pk=self.donation.pk).update(donor_email_encrypted="")
        self._update(Donation.PaymentStatus.COMPLETED)
        send.assert_not_called()

    @patch(SEND, side_effect=RuntimeError("boom"))
    def test_send_failure_does_not_raise(self, send):
        self.assertTrue(self._update(Donation.PaymentStatus.COMPLETED))
        self.donation.refresh_from_db()
        self.assertEqual(self.donation.payment_status, Donation.PaymentStatus.COMPLETED)

    @patch(SEND)
    def test_receipt_function_ignores_non_completed_donation(self, send):
        send_donation_receipt(self.donation.pk)
        send.assert_not_called()
