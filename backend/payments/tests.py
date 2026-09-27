from datetime import date
from decimal import Decimal
from unittest.mock import Mock, patch

from django.db import DatabaseError
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIRequestFactory

from donations.models import Donation

from .views import (
    PaymentSessionCreateView,
    StripeWebhookView,
    _update_donation_payment_status,
)


@override_settings(
    FRONTEND_URL="http://localhost:3000",
    STRIPE_WEBHOOK_SECRET="whsec_test",
)
class SecurePaymentDatabaseTests(TestCase):
    """Tests for restricted and failure-safe payment database operations."""

    def setUp(self):
        """Create requests without starting a development server."""
        self.factory = APIRequestFactory()

    def create_donation(self, **overrides):
        """Create a valid Donation while allowing one field to vary per test."""
        data = {
            "donor_first_name": "Test",
            "donor_last_name": "Donor",
            "donor_email": "test@example.com",
            "amount": Decimal("10.00"),
            "donation_date": date.today(),
            "is_anonymous": False,
            "message": "Keep this message",
            "payment_status": Donation.PaymentStatus.PENDING,
            "reference_id": "DON-00000001",
        }
        data.update(overrides)
        return Donation.objects.create(**data)

    def session_request(self, *, amount="10.00", reference="DON-00000001"):
        """Build the same JSON request sent by the donation frontend."""
        return self.factory.post(
            "/api/payments/session/",
            {
                "amount": amount,
                "currency": "usd",
                "payment_purpose": "Donation",
                "internal_reference": reference,
            },
            format="json",
        )

    @patch("payments.views.create_payment_session")
    def test_session_uses_the_amount_stored_on_the_donation(self, create_session):
        """Stripe must receive the trusted database amount after comparison."""
        donation = self.create_donation()

        # Prevent a real Stripe API request and record the service arguments.
        create_session.return_value = {
            "session_id": "cs_test_safe",
            "client_secret": "client_secret_for_test",
        }

        response = PaymentSessionCreateView.as_view()(self.session_request())

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_session.call_args.kwargs["amount"], donation.amount)

    @patch("payments.views.create_payment_session")
    def test_session_rejects_an_amount_that_does_not_match(self, create_session):
        """A browser cannot lower the amount after the Donation is created."""
        self.create_donation()

        response = PaymentSessionCreateView.as_view()(
            self.session_request(amount="1.00")
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        create_session.assert_not_called()

    @patch("payments.views.Donation.objects.only")
    def test_session_database_error_returns_a_safe_response(self, only):
        """Database exception details must stay out of responses and logs."""
        # The fake detail represents information that must never be exposed.
        only.side_effect = DatabaseError("database-secret-for-test")

        with self.assertLogs("payments.views", level="ERROR") as captured_logs:
            response = PaymentSessionCreateView.as_view()(self.session_request())

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(
            response.data,
            {"detail": "Payment processing is temporarily unavailable."},
        )
        exposed_text = f"{response.data} {' '.join(captured_logs.output)}"
        self.assertNotIn("database-secret-for-test", exposed_text)

    def test_status_update_changes_only_the_payment_status(self):
        """Webhook processing must leave amount and donor fields unchanged."""
        donation = self.create_donation()

        updated = _update_donation_payment_status(
            donation.reference_id,
            Donation.PaymentStatus.FAILED,
        )

        donation.refresh_from_db()
        self.assertTrue(updated)
        self.assertEqual(donation.payment_status, Donation.PaymentStatus.FAILED)
        self.assertEqual(donation.amount, Decimal("10.00"))
        self.assertEqual(donation.message, "Keep this message")
        self.assertEqual(donation.donor_email, "test@example.com")

    def test_completed_donation_cannot_be_downgraded(self):
        """A late failure event cannot undo a confirmed successful payment."""
        donation = self.create_donation(
            payment_status=Donation.PaymentStatus.COMPLETED
        )

        updated = _update_donation_payment_status(
            donation.reference_id,
            Donation.PaymentStatus.FAILED,
        )

        donation.refresh_from_db()
        self.assertFalse(updated)
        self.assertEqual(donation.payment_status, Donation.PaymentStatus.COMPLETED)

    def test_duplicate_status_update_does_not_write_again(self):
        """Repeated Stripe deliveries are treated as idempotent operations."""
        donation = self.create_donation()

        updated = _update_donation_payment_status(
            donation.reference_id,
            Donation.PaymentStatus.PENDING,
        )

        self.assertFalse(updated)

    def test_status_update_rejects_an_unsupported_value(self):
        """The update helper validates status before accessing the database."""
        donation = self.create_donation()

        with self.assertRaises(ValueError):
            _update_donation_payment_status(donation.reference_id, "invalid")

        donation.refresh_from_db()
        self.assertEqual(donation.payment_status, Donation.PaymentStatus.PENDING)

    @patch("payments.views._update_donation_payment_status")
    @patch("payments.views.stripe.Webhook.construct_event")
    def test_webhook_database_error_is_retryable_and_safe(
        self,
        construct_event,
        update_status,
    ):
        """A temporary failure returns 503 without revealing its exception."""
        # Simulate a Stripe event that has already passed signature checking.
        event = Mock()
        event.to_dict.return_value = {
            "id": "evt_safe_test",
            "type": "payment_intent.succeeded",
            "data": {
                "object": {
                    "metadata": {"internal_reference": "DON-00000001"}
                }
            },
        }
        construct_event.return_value = event

        # Force only the database-update step to fail.
        update_status.side_effect = DatabaseError("database-secret-for-test")
        request = self.factory.post(
            "/api/payments/webhook/",
            b"{}",
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE="test-signature",
        )

        with self.assertLogs("payments.views", level="ERROR") as captured_logs:
            response = StripeWebhookView.as_view()(request)

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(
            response.data,
            {"detail": "Webhook processing is temporarily unavailable."},
        )
        exposed_text = f"{response.data} {' '.join(captured_logs.output)}"
        self.assertNotIn("database-secret-for-test", exposed_text)
