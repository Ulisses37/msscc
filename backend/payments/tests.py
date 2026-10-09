from datetime import date
from decimal import Decimal
from unittest.mock import Mock, patch

import stripe
from django.db import DatabaseError
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIRequestFactory

from donations.models import Donation

from .views import (
    MembershipPaymentSessionCreateView,
    PaymentSessionCreateView,
    StripeWebhookView,
    _update_donation_payment_status,
)


@override_settings(STRIPE_SECRET_KEY="sk_test_dummy")
class MembershipPaymentSessionTests(TestCase):
    """Membership requests must not be able to choose their Stripe price."""

    def setUp(self):
        self.factory = APIRequestFactory()

    def test_membership_route_is_registered(self):
        self.assertEqual(
            reverse("membership-payment-session-create"),
            "/api/payments/membership/session/",
        )

    def request(self, **overrides):
        data = {"membership_option_id": "student", "payment_purpose": "membership"}
        data.update(overrides)
        return self.factory.post("/api/payments/membership/session/", data, format="json")

    @patch("payments.services.stripe_service.StripeClient")
    def test_each_option_uses_the_server_price_in_cents(self, stripe_client):
        """Mock only the Stripe boundary so the view and conversion run for real."""
        intent = stripe_client.return_value.v1.payment_intents.create.return_value
        intent.id = "pi_test_membership"
        intent.client_secret = "pi_test_secret_membership"

        for option_id, cents in (
            ("student", 2000),
            ("individual", 3500),
            ("family", 5000),
            ("corporate", 25000),
        ):
            with self.subTest(option_id=option_id):
                response = MembershipPaymentSessionCreateView.as_view()(
                    self.request(membership_option_id=option_id)
                )
                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                self.assertEqual(
                    response.data,
                    {
                        "session_id": "pi_test_membership",
                        "client_secret": "pi_test_secret_membership",
                    },
                )
                params = stripe_client.return_value.v1.payment_intents.create.call_args.args[0]
                self.assertEqual(params["amount"], cents)
                self.assertEqual(params["currency"], "usd")
                self.assertEqual(params["metadata"]["payment_purpose"], "membership")
                self.assertEqual(params["metadata"]["membership_option_id"], option_id)
                self.assertNotIn("confirm", params)

    @patch("payments.views.create_membership_payment_intent")
    def test_missing_or_unknown_option_is_rejected(self, create_intent):
        for request in (
            self.factory.post(
                "/api/payments/membership/session/",
                {"payment_purpose": "membership"},
                format="json",
            ),
            self.request(membership_option_id="unavailable"),
            self.request(membership_option_id=""),
            self.request(payment_purpose="donation"),
            self.factory.post(
                "/api/payments/membership/session/",
                {"membership_option_id": "student"},
                format="json",
            ),
        ):
            with self.subTest(request=request.body):
                response = MembershipPaymentSessionCreateView.as_view()(request)
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        create_intent.assert_not_called()

    @patch("payments.views.create_membership_payment_intent")
    def test_amount_and_card_fields_cannot_enter_session_request(self, create_intent):
        for extra in ({"amount": "0.01"}, {"card_number": "4242424242424242"}):
            with self.subTest(extra=extra):
                response = MembershipPaymentSessionCreateView.as_view()(self.request(**extra))
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertNotIn("4242424242424242", str(response.data))
        create_intent.assert_not_called()

    @patch("payments.views.create_membership_payment_intent")
    def test_view_passes_only_server_price_to_service(self, create_intent):
        create_intent.return_value = {
            "session_id": "pi_test_membership",
            "client_secret": "pi_test_secret_membership",
        }
        response = MembershipPaymentSessionCreateView.as_view()(
            self.request(membership_option_id="family")
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        create_intent.assert_called_once_with(
            amount=Decimal("50.00"), membership_option_id="family"
        )

    @patch("payments.views.create_membership_payment_intent")
    def test_stripe_failure_does_not_expose_details(self, create_intent):
        create_intent.side_effect = stripe.StripeError("stripe-secret-for-test")
        with self.assertLogs("payments.views", level="ERROR") as captured_logs:
            response = MembershipPaymentSessionCreateView.as_view()(self.request())
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(response.data, {"detail": "Unable to create payment session."})
        self.assertNotIn("stripe-secret-for-test", str(response.data) + str(captured_logs.output))

    @patch("payments.views.create_membership_payment_intent")
    def test_session_creation_runtime_failure_does_not_expose_details(self, create_intent):
        """A missing Stripe client secret must not leak an upstream exception."""
        create_intent.side_effect = RuntimeError("private-client-secret-detail")
        with self.assertLogs("payments.views", level="ERROR") as captured_logs:
            response = MembershipPaymentSessionCreateView.as_view()(self.request())
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(response.data, {"detail": "Unable to create payment session."})
        self.assertNotIn(
            "private-client-secret-detail", str(response.data) + str(captured_logs.output)
        )

    @patch("payments.services.stripe_service.StripeClient")
    def test_missing_stripe_fields_produce_safe_response(self, stripe_client):
        intent = stripe_client.return_value.v1.payment_intents.create.return_value
        for intent_id, client_secret in (("", "pi_secret"), ("pi_test", None)):
            with self.subTest(intent_id=intent_id, client_secret=client_secret):
                intent.id = intent_id
                intent.client_secret = client_secret
                with self.assertLogs("payments.views", level="ERROR"):
                    response = MembershipPaymentSessionCreateView.as_view()(self.request())
                self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
                self.assertEqual(response.data, {"detail": "Unable to create payment session."})


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

        response = PaymentSessionCreateView.as_view()(self.session_request(amount="1.00"))

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
        donation = self.create_donation(payment_status=Donation.PaymentStatus.COMPLETED)

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
            "data": {"object": {"metadata": {"internal_reference": "DON-00000001"}}},
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


class PaymentInputValidationTests(TestCase):
    """Boundary cases for the two public payment-session contracts."""

    def setUp(self):
        self.factory = APIRequestFactory()

    def membership_request(self, data):
        return MembershipPaymentSessionCreateView.as_view()(
            self.factory.post("/api/payments/membership/session/", data, format="json")
        )

    def donation_request(self, data):
        return PaymentSessionCreateView.as_view()(
            self.factory.post("/api/payments/session/", data, format="json")
        )

    @patch("payments.views.create_membership_payment_intent")
    def test_membership_id_rejects_non_strings_and_unavailable_options(self, create_intent):
        for option in (1, True, ["student"], {"id": "student"}, "unknown"):
            with self.subTest(option=option):
                response = self.membership_request(
                    {"membership_option_id": option, "payment_purpose": "membership"}
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("membership_option_id", response.data)
        create_intent.assert_not_called()

    @patch("payments.views.create_membership_payment_intent")
    def test_membership_rejects_price_currency_and_card_fields(self, create_intent):
        for field in ("amount", "currency", "card_number", "cvc", "client_secret"):
            with self.subTest(field=field):
                response = self.membership_request(
                    {"membership_option_id": "student", "payment_purpose": "membership",
                     field: "private-test-value"}
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertNotIn("private-test-value", str(response.data))
        create_intent.assert_not_called()

    @patch("payments.views.create_payment_session")
    def test_donation_requires_fields_and_validated_reference(self, create_session):
        base = {"amount": "10.00", "currency": "usd", "payment_purpose": "Donation",
                "internal_reference": "DON-00000001"}
        for field in base:
            with self.subTest(missing=field):
                response = self.donation_request({k: v for k, v in base.items() if k != field})
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field, response.data)
        # A quote, Boolean condition and SQL comment must never be interpreted
        # as a reference lookup or escape the validation boundary.
        for reference in ("DON-1", "DON-00000001' OR 1=1 --", "MEM-00000001", 1):
            with self.subTest(reference=reference):
                response = self.donation_request({**base, "internal_reference": reference})
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("internal_reference", response.data)
        create_session.assert_not_called()

    @patch("payments.views.create_payment_session")
    def test_donation_rejects_unsupported_currency_and_extra_fields(self, create_session):
        base = {"amount": "10.00", "currency": "usd", "payment_purpose": "Donation",
                "internal_reference": "DON-00000001"}
        for override in ({"currency": "eur"}, {"currency": 1}, {"amount": True},
                         {"payment_purpose": 1}, {"card_number": "private-test-value"},
                         {"client_secret": "private-test-value"}):
            with self.subTest(override=override):
                response = self.donation_request({**base, **override})
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertNotIn("private-test-value", str(response.data))
        create_session.assert_not_called()

    @patch("payments.views.create_payment_session")
    def test_unknown_reference_cannot_pass_browser_supplied_amount_to_stripe(self, create_session):
        response = self.donation_request(
            {"amount": "0.01", "currency": "usd", "payment_purpose": "Donation",
             "internal_reference": "DON-99999999"}
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        create_session.assert_not_called()
