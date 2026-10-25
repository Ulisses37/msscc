from datetime import UTC, date, datetime
from decimal import Decimal
from unittest.mock import Mock, patch

import stripe
from django.db import DatabaseError, IntegrityError, transaction
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory

from donations.models import Donation, Membership
from payments.serializers import MEMBERSHIP_PRICES

from .views import (
    MembershipPaymentSessionCreateView,
    MembershipPaymentStatusView,
    MembershipQuoteView,
    PaymentReceiptView,
    PaymentSessionCreateView,
    PaymentStatusView,
    StripeWebhookView,
    _update_donation_payment_status,
)


class PaymentReceiptTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.donation_reference = "DON-00000042"
        self.membership_reference = "MEM-" + "a" * 32
        self.completed_at = datetime(2026, 10, 10, 15, 30, tzinfo=UTC)
        self.donation = Donation.objects.create(
            donor_first_name_encrypted="Maya", donor_last_name_encrypted="Chen",
            donor_email_encrypted="private@example.com", amount=Decimal("12.50"),
            donation_date=date(2026, 10, 1), is_anonymous=False,
            message="private donor message is not a purpose",
            reference_id=self.donation_reference,
            payment_status=Donation.PaymentStatus.COMPLETED,
            completed_at=self.completed_at,
        )
        self.membership = Membership.objects.create(
            first_name_encrypted="Maya", last_name_encrypted="Chen",
            email_encrypted="member@example.com", phone_encrypted="private phone",
            membership_type="student",
            membership_option_id="student", amount_paid=Decimal("20.00"),
            currency="usd", expected_amount=Decimal("20.00"),
            start_date=date(2026, 10, 10), end_date=date(2027, 10, 9),
            renewal_date=date(2027, 10, 10),
            payment_status=Membership.PaymentStatus.COMPLETED,
            completed_at=self.completed_at, status="active", notes="private note",
            reference_id=self.membership_reference,
            checkout_reference=self.membership_reference,
            stripe_payment_intent_id="pi_private_test",
        )

    def receipt(self, reference, **extra):
        return PaymentReceiptView.as_view()(
            self.factory.get(reverse("payment-receipt"), {
                "confirmation_reference": reference, **extra,
            })
        )

    def test_donation_receipt_contains_only_stored_safe_values(self):
        response = self.receipt(self.donation_reference, amount="999", donation_purpose="forged")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {
            "payment_purpose": "donation", "amount": "12.50",
            "base_amount": "12.50", "processing_cost_contribution": "0.00",
            "total_amount": "12.50",
            "currency": "usd", "completed_at": "2026-10-10T15:30:00Z",
            "confirmation_reference": self.donation_reference,
        })
        self.assertNotIn("private", str(response.data))
        self.assertNotIn("donation_id", response.data)
        self.assertNotIn("donation_purpose", response.data)

    def test_anonymous_donation_receipt_omits_identity_and_address(self):
        """A public receipt exposes payment facts, not the retained donor email."""
        self.donation.is_anonymous = True
        self.donation.donor_first_name_encrypted = "Anonymous"
        self.donation.donor_last_name_encrypted = ""
        self.donation.save(update_fields=[
            "is_anonymous", "donor_first_name_encrypted", "donor_last_name_encrypted",
        ])
        response = self.receipt(self.donation_reference)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["confirmation_reference"], self.donation_reference)
        for field in ("donor_first_name", "donor_last_name", "donor_email", "address"):
            self.assertNotIn(field, response.data)
        for value in ("Anonymous", "private@example.com", "Maya", "Chen"):
            self.assertNotIn(value, str(response.data))

    def test_membership_receipt_excludes_profile_and_stripe_fields(self):
        response = self.receipt(self.membership_reference, amount="999")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {
            "payment_purpose": "membership", "amount": "20.00",
            "currency": "usd", "completed_at": "2026-10-10T15:30:00Z",
            "confirmation_reference": self.membership_reference,
            "membership_option": "student",
        })
        for sensitive in ("pi_private_test", "member@example.com", "private phone",
                          "membership_id", "expected_amount", "client_secret"):
            self.assertNotIn(sensitive, str(response.data))

    def test_pending_failed_canceled_and_missing_completion_date_are_unavailable(self):
        for model, reference in ((self.donation, self.donation_reference),
                                 (self.membership, self.membership_reference)):
            for state in ("pending", "failed", "canceled"):
                with self.subTest(reference=reference, state=state):
                    model.payment_status = state
                    model.save(update_fields=["payment_status"])
                    self.assertEqual(self.receipt(reference).status_code, 404)
            model.payment_status = "completed"
            model.completed_at = None
            model.save(update_fields=["payment_status", "completed_at"])
            self.assertEqual(self.receipt(reference).status_code, 404)

    def test_unknown_malformed_and_unlinked_references_share_safe_response(self):
        unknown = self.receipt("MEM-" + "b" * 32)
        for reference in ("pi_secret", "DON-00000099", "MEM-INVALID", ""):
            with self.subTest(reference=reference):
                response = self.receipt(reference)
                self.assertEqual(response.status_code, 404)
                self.assertEqual(response.data, unknown.data)
        self.membership.stripe_payment_intent_id = None
        self.membership.save(update_fields=["stripe_payment_intent_id"])
        self.assertEqual(self.receipt(self.membership_reference).data, unknown.data)

    def test_webhook_completion_records_timestamp_once(self):
        self.donation.payment_status = Donation.PaymentStatus.PENDING
        self.donation.completed_at = None
        self.donation.save(update_fields=["payment_status", "completed_at"])
        with patch("payments.views.timezone.now", return_value=self.completed_at):
            self.assertTrue(_update_donation_payment_status(
                self.donation_reference, Donation.PaymentStatus.COMPLETED
            ))
        self.donation.refresh_from_db()
        self.assertEqual(self.donation.completed_at, self.completed_at)
        self.assertFalse(_update_donation_payment_status(
            self.donation_reference, Donation.PaymentStatus.COMPLETED
        ))
        self.donation.refresh_from_db()
        self.assertEqual(self.donation.completed_at, self.completed_at)
        self.assertEqual(self.receipt(self.donation_reference).status_code, 200)

    @patch("payments.views.stripe.checkout.Session.retrieve")
    def test_donation_return_status_only_provides_reference_after_completion(self, retrieve):
        retrieve.return_value.to_dict.return_value = {
            "client_reference_id": self.donation_reference,
        }
        request = self.factory.get(reverse("payment-status"), {"session_id": "cs_test_safe"})
        for state in ("pending", "failed", "canceled", "completed"):
            with self.subTest(state=state):
                self.donation.payment_status = state
                self.donation.save(update_fields=["payment_status"])
                response = PaymentStatusView.as_view()(request)
                self.assertEqual(response.status_code, 200)
                expected = {"payment_status": state}
                if state == "completed":
                    expected["confirmation_reference"] = self.donation_reference
                self.assertEqual(response.data, expected)


class MembershipPaymentStatusSmokeTests(TestCase):
    """Keep the first status-endpoint commit independently verifiable."""

    def setUp(self):
        self.reference = "MEM-" + "a" * 32
        self.member = Membership.objects.create(
            first_name_encrypted="Maya", last_name_encrypted="Chen",
            email_encrypted="maya@example.com", phone_encrypted="",
            membership_type="student", amount_paid=0, start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 1), renewal_date=date(2025, 1, 1),
            payment_status=Membership.PaymentStatus.PENDING, status="pending", notes="",
            reference_id=self.reference, checkout_reference=self.reference,
            stripe_payment_intent_id="pi_status_test",
        )
        self.factory = APIRequestFactory()

    def status_for(self, reference):
        return MembershipPaymentStatusView.as_view()(
            self.factory.get("/api/payments/membership/status/", {
                "confirmation_reference": reference,
                "payment_status": "complete",  # Client input cannot change stored state.
            })
        )

    def test_status_is_database_backed_read_only_and_minimal(self):
        self.assertEqual(reverse("membership-payment-status"), "/api/payments/membership/status/")
        self.assertEqual(self.status_for(self.reference).data, {
            "payment_purpose": "membership", "payment_status": "pending",
        })
        self.member.payment_status = Membership.PaymentStatus.COMPLETED
        self.member.save(update_fields=["payment_status"])
        self.assertEqual(self.status_for(self.reference).data, {
            "payment_purpose": "membership", "payment_status": "complete",
        })
        self.member.refresh_from_db()
        self.assertEqual(self.member.payment_status, Membership.PaymentStatus.COMPLETED)

    def test_each_stored_payment_state_is_read_only_and_normalized(self):
        for stored, public in (
            (Membership.PaymentStatus.PENDING, "pending"),
            (Membership.PaymentStatus.COMPLETED, "complete"),
            (Membership.PaymentStatus.FAILED, "failed"),
            (Membership.PaymentStatus.CANCELED, "canceled"),
        ):
            with self.subTest(stored=stored):
                self.member.payment_status = stored
                self.member.save(update_fields=["payment_status"])
                # status_for deliberately sends a forged 'complete' query value;
                # even repeated reads must return only the database state.
                for _ in range(2):
                    response = self.status_for(self.reference)
                    self.assertEqual(response.status_code, status.HTTP_200_OK)
                    self.assertEqual(response.data, {
                        "payment_purpose": "membership", "payment_status": public,
                    })
                self.member.refresh_from_db()
                self.assertEqual(self.member.payment_status, stored)

    def test_unknown_and_malformed_references_share_a_safe_404(self):
        expected = {"detail": "Payment status was not found."}
        for reference in ("MEM-invalid", "MEM-" + "b" * 32):
            with self.subTest(reference=reference):
                response = self.status_for(reference)
                self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
                self.assertEqual(response.data, expected)

    @patch("payments.views.Membership.objects.only")
    def test_database_failure_hides_private_details(self, only):
        only.side_effect = DatabaseError("private-database-detail")
        with self.assertLogs("payments.views", level="ERROR") as logs:
            response = self.status_for(self.reference)
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertNotIn("private-database-detail", str(response.data) + str(logs.output))


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
        data = {
            "membership_option_id": "student", "payment_purpose": "membership",
            "first_name": "Maya", "last_name": "Chen", "email": "maya@example.com",
            "phone": "555-0100",
        }
        data.update(overrides)
        return self.factory.post("/api/payments/membership/session/", data, format="json")

    def test_quote_is_server_priced_and_rejects_forged_totals(self):
        self.assertEqual(reverse("membership-quote"), "/api/payments/membership/quote/")
        # Derive the no-fee base from the server catalog. Keep the opted-in
        # exact values independent of the pricing function to detect drift.
        base = MEMBERSHIP_PRICES["student"]
        for choice, expected_contribution, expected_total in (
            (False, Decimal("0.00"), base),
            (True, Decimal("0.91"), Decimal("20.91")),
        ):
            with self.subTest(choice=choice):
                response = MembershipQuoteView.as_view()(self.factory.post(
                    reverse("membership-quote"),
                    {"membership_option_id": "student", "contribute_to_processing_costs": choice},
                    format="json",
                ))
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data, {
                    "amount": f"{base:.2f}",
                    "processing_cost_contribution": f"{expected_contribution:.2f}",
                    "total_amount": f"{expected_total:.2f}",
                })
        for extra in ({"total_amount": "0.01"}, {"contribute_to_processing_costs": "true"}):
            response = MembershipQuoteView.as_view()(self.factory.post(
                reverse("membership-quote"),
                {"membership_option_id": "student", **extra}, format="json",
            ))
            self.assertEqual(response.status_code, 400)
        self.assertFalse(Membership.objects.exists())

    @patch("payments.services.stripe_service.StripeClient")
    def test_opt_in_charges_saved_total_and_receipt_uses_saved_amounts(self, stripe_client):
        intent = stripe_client.return_value.v1.payment_intents.create.return_value
        intent.id = "pi_test_opt_in"
        intent.client_secret = "pi_test_opt_in_secret"
        response = MembershipPaymentSessionCreateView.as_view()(
            self.request(contribute_to_processing_costs=True)
        )
        self.assertEqual(response.status_code, 201)
        member = Membership.objects.get(stripe_payment_intent_id=intent.id)
        self.assertEqual(member.base_amount, Decimal("20.00"))
        self.assertTrue(member.contribute_to_processing_costs)
        self.assertEqual(member.processing_cost_contribution, Decimal("0.91"))
        self.assertEqual(member.expected_amount, Decimal("20.91"))
        self.assertEqual(response.data["amount"], "20.00")
        self.assertEqual(response.data["processing_cost_contribution"], "0.91")
        self.assertEqual(response.data["total_amount"], "20.91")
        params = stripe_client.return_value.v1.payment_intents.create.call_args.args[0]
        self.assertEqual(params["amount"], 2091)
        member.payment_status = Membership.PaymentStatus.COMPLETED
        member.amount_paid = member.expected_amount
        member.completed_at = datetime(2026, 10, 10, 15, 30, tzinfo=UTC)
        member.save(update_fields=["payment_status", "amount_paid", "completed_at"])
        receipt = PaymentReceiptView.as_view()(self.factory.get(reverse("payment-receipt"), {
            "confirmation_reference": member.checkout_reference,
        }))
        self.assertEqual(receipt.status_code, 200)
        self.assertEqual(receipt.data["base_amount"], "20.00")
        self.assertEqual(receipt.data["processing_cost_contribution"], "0.91")
        self.assertEqual(receipt.data["total_amount"], "20.91")

    @patch("payments.services.stripe_service.StripeClient")
    def test_each_option_uses_the_server_price_in_cents(self, stripe_client):
        """Mock only the Stripe boundary so the view and conversion run for real."""
        intent = stripe_client.return_value.v1.payment_intents.create.return_value
        intent.client_secret = "pi_test_secret_membership"

        for option_id, cents in (
            ("student", 2000),
            ("individual", 3500),
            ("family", 5000),
            ("corporate", 25000),
        ):
            with self.subTest(option_id=option_id):
                intent.id = f"pi_test_{option_id}"
                response = MembershipPaymentSessionCreateView.as_view()(
                    self.request(membership_option_id=option_id)
                )
                self.assertEqual(response.status_code, status.HTTP_201_CREATED)
                membership = Membership.objects.get(stripe_payment_intent_id=intent.id)
                self.assertEqual(
                    response.data,
                    {
                        "session_id": f"pi_test_{option_id}",
                        "client_secret": "pi_test_secret_membership",
                        "confirmation_reference": membership.checkout_reference,
                        "amount": f"{Decimal(cents) / 100:.2f}",
                        "processing_cost_contribution": "0.00",
                        "total_amount": f"{Decimal(cents) / 100:.2f}",
                    },
                )
                params = stripe_client.return_value.v1.payment_intents.create.call_args.args[0]
                self.assertEqual(params["amount"], cents)
                self.assertEqual(params["currency"], "usd")
                self.assertEqual(params["metadata"]["payment_purpose"], "membership")
                self.assertEqual(params["metadata"]["membership_option_id"], option_id)
                self.assertEqual(
                    params["metadata"]["internal_reference"], membership.checkout_reference
                )
                self.assertEqual(membership.payment_status, Membership.PaymentStatus.PENDING)
                self.assertEqual(membership.status, "pending")
                self.assertEqual(membership.amount_paid, 0)
                self.assertEqual(membership.expected_amount, Decimal(cents) / 100)
                self.assertEqual(membership.currency, "usd")
                self.assertEqual(membership.email_encrypted, "maya@example.com")
                self.assertEqual(membership.first_name_encrypted, "Maya")
                self.assertEqual(membership.last_name_encrypted, "Chen")
                self.assertEqual(membership.phone_encrypted, "555-0100")
                self.assertEqual(membership.reference_id, membership.checkout_reference)
                self.assertIsNotNone(membership.created_at)
                self.assertIsNotNone(membership.updated_at)
                self.assertNotIn("email", params["metadata"])
                for sensitive in ("Maya", "Chen", "maya@example.com", "555-0100"):
                    self.assertNotIn(sensitive, str(params["metadata"]))
                self.assertNotIn("confirm", params)
        self.assertEqual(Membership.objects.count(), 4)
        self.assertEqual(
            Membership.objects.values("checkout_reference").distinct().count(), 4
        )

    @patch("donations.services.create_membership_payment_intent")
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
        self.assertEqual(Membership.objects.count(), 0)

    @patch("donations.services.create_membership_payment_intent")
    def test_missing_identity_and_billing_fields_are_rejected(self, create_intent):
        for field in ("first_name", "last_name", "email"):
            with self.subTest(field=field):
                # Rebuild the JSON body without the required field.
                data = {
                    "membership_option_id": "student", "payment_purpose": "membership",
                    "first_name": "Maya", "last_name": "Chen", "email": "maya@example.com",
                }
                data.pop(field)
                request = self.factory.post(
                    "/api/payments/membership/session/", data, format="json"
                )
                response = MembershipPaymentSessionCreateView.as_view()(request)
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        for extra in ({"address": "123 Main St"}, {"client_secret": "pi_private"}):
            response = MembershipPaymentSessionCreateView.as_view()(self.request(**extra))
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        create_intent.assert_not_called()
        self.assertFalse(Membership.objects.exists())

    @patch("donations.services.create_membership_payment_intent")
    def test_amount_and_card_fields_cannot_enter_session_request(self, create_intent):
        for extra in ({"amount": "0.01"}, {"card_number": "4242424242424242"}):
            with self.subTest(extra=extra):
                response = MembershipPaymentSessionCreateView.as_view()(self.request(**extra))
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertNotIn("4242424242424242", str(response.data))
        create_intent.assert_not_called()

    @patch("donations.services.create_membership_payment_intent")
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
            amount=Decimal("50.00"), membership_option_id="family",
            internal_reference=Membership.objects.get().checkout_reference,
        )

    @patch("donations.services.create_membership_payment_intent")
    def test_stripe_failure_does_not_expose_details(self, create_intent):
        create_intent.side_effect = stripe.StripeError("stripe-secret-for-test")
        with self.assertLogs("payments.views", level="ERROR") as captured_logs:
            response = MembershipPaymentSessionCreateView.as_view()(self.request())
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(response.data, {"detail": "Unable to create payment session."})
        self.assertNotIn("stripe-secret-for-test", str(response.data) + str(captured_logs.output))
        self.assertFalse(Membership.objects.exists())

    @patch("donations.services.create_membership_payment_intent")
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
        self.assertFalse(Membership.objects.exists())

    @patch("donations.services.cancel_membership_payment_intent")
    @patch("donations.services.create_membership_payment_intent")
    def test_link_failure_rolls_back_and_cancels_intent(self, create_intent, cancel):
        # Stripe is outside the SQL transaction; if linking fails, the secret
        # never reaches the client and we attempt to cancel the orphaned intent.
        create_intent.return_value = {"session_id": "pi_orphan", "client_secret": "private"}
        original_save = Membership.save

        def fail_only_link(member, *args, **kwargs):
            if kwargs.get("update_fields"):
                raise DatabaseError("private-db-error")
            return original_save(member, *args, **kwargs)

        with patch.object(Membership, "save", fail_only_link):
            with self.assertLogs("payments.views", level="ERROR") as captured:
                response = MembershipPaymentSessionCreateView.as_view()(self.request())
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertNotIn("private-db-error", str(response.data) + str(captured.output))
        cancel.assert_called_once_with("pi_orphan")
        self.assertFalse(Membership.objects.exists())

    @patch("donations.services.create_membership_payment_intent")
    def test_duplicate_stripe_identifier_cannot_link_two_memberships(self, create_intent):
        create_intent.return_value = {"session_id": "pi_shared", "client_secret": "pi_secret"}
        first = MembershipPaymentSessionCreateView.as_view()(self.request())
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        with patch("donations.services.cancel_membership_payment_intent"):
            second = MembershipPaymentSessionCreateView.as_view()(self.request())
        self.assertEqual(second.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(Membership.objects.count(), 1)

    def test_stripe_intent_identifier_has_database_uniqueness(self):
        # Manual records have no Stripe ID; multiple NULLs must remain valid.
        base = dict(first_name_encrypted="Maya", last_name_encrypted="Chen",
                    email_encrypted="maya@example.com", phone_encrypted="",
                    membership_type="student", amount_paid=0,
                    start_date=date.today(), end_date=date.today(), renewal_date=date.today(),
                    reference_id="manual", status="pending", notes="")
        Membership.objects.create(**base, stripe_payment_intent_id="pi_unique")
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Membership.objects.create(**base, stripe_payment_intent_id="pi_unique")
        Membership.objects.create(**base)
        Membership.objects.create(**base)
        self.assertEqual(Membership.objects.count(), 3)

    def test_checkout_reference_has_database_uniqueness(self):
        # Admin-entered reference_id remains non-unique for historical rows;
        # checkout_reference is the strict key used to find a paid member.
        base = dict(first_name_encrypted="Maya", last_name_encrypted="Chen",
                    email_encrypted="maya@example.com", phone_encrypted="",
                    membership_type="student", amount_paid=0,
                    start_date=date.today(), end_date=date.today(), renewal_date=date.today(),
                    reference_id="manual", status="pending", notes="")
        Membership.objects.create(**base, checkout_reference="MEM-unique")
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Membership.objects.create(**base, checkout_reference="MEM-unique")
        self.assertEqual(Membership.objects.count(), 1)

    @patch("donations.services.create_membership_payment_intent")
    @patch("donations.services.Membership.objects.create")
    def test_record_failure_does_not_call_stripe(self, create_member, create_intent):
        create_member.side_effect = DatabaseError("private-db-error")
        with self.assertLogs("payments.views", level="ERROR") as captured:
            response = MembershipPaymentSessionCreateView.as_view()(self.request())
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertNotIn("private-db-error", str(response.data) + str(captured.output))
        create_intent.assert_not_called()
        self.assertFalse(Membership.objects.exists())

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
            "donor_first_name_encrypted": "Test",
            "donor_last_name_encrypted": "Donor",
            "donor_email_encrypted": "test@example.com",
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
    def test_opted_in_session_charges_saved_total_not_base_or_browser_total(self, create_session):
        """The request's base is only a guard; the database controls Stripe's price."""
        donation = self.create_donation(
            contribute_to_processing_costs=True,
            processing_cost_contribution=Decimal("0.61"),
            total_amount=Decimal("10.61"),
        )
        create_session.return_value = {"session_id": "cs_test", "client_secret": "safe"}
        response = PaymentSessionCreateView.as_view()(self.session_request())
        self.assertEqual(response.status_code, 201)
        self.assertEqual(create_session.call_args.kwargs["amount"], donation.total_amount)
        response = PaymentSessionCreateView.as_view()(self.session_request(amount="10.61"))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(create_session.call_count, 1)

    @patch("payments.views.create_payment_session")
    def test_donation_quote_creation_checkout_and_receipt_agree(self, create_session):
        """Quote, saved donation, checkout charge, and receipt must agree."""
        client = APIClient()
        choice = {"amount": "12.50", "contribute_to_processing_costs": True}
        quote = client.post("/api/donations/quote/", choice, format="json")
        self.assertEqual(quote.status_code, 200)
        # Deliberately forge fee and total in the request: the server must
        # calculate and save its own values, not trust browser-supplied prices.
        created = client.post("/api/donations/", {
            **choice, "donor_first_name": "Test", "donor_last_name": "Donor",
            "donor_email": "donor@example.test",
            "processing_cost_contribution": "0.00", "total_amount": "0.01",
        }, format="json")
        self.assertEqual(created.status_code, 201)
        donation = Donation.objects.get(pk=created.data["donation_id"])
        self.assertTrue(donation.contribute_to_processing_costs)
        for field in ("amount", "processing_cost_contribution", "total_amount"):
            self.assertEqual(created.data[field], quote.data[field])
            stored = donation.amount if field == "amount" else getattr(donation, field)
            self.assertEqual(stored, Decimal(quote.data[field]))

        # Stripe is mocked; inspect the amount handed to it, not a real charge.
        create_session.return_value = {"session_id": "cs_test", "client_secret": "safe"}
        checkout = client.post("/api/payments/session/", {
            "amount": choice["amount"], "currency": "usd",
            "payment_purpose": "Donation", "internal_reference": donation.reference_id,
        }, format="json")
        self.assertEqual(checkout.status_code, 201)
        self.assertEqual(create_session.call_args.kwargs["amount"], donation.total_amount)
        self.assertEqual(donation.total_amount, Decimal("13.18"))

        # A receipt requires a completed record. Simulate that state here;
        # webhook verification and actual payment are outside this test.
        donation.payment_status = Donation.PaymentStatus.COMPLETED
        donation.completed_at = datetime(2026, 10, 10, 15, 30, tzinfo=UTC)
        donation.save(update_fields=["payment_status", "completed_at"])
        receipt = client.get("/api/payments/receipt/", {
            "confirmation_reference": donation.reference_id,
        })
        self.assertEqual(receipt.status_code, 200)
        self.assertEqual(receipt.data["amount"], quote.data["total_amount"])
        self.assertEqual(receipt.data["base_amount"], quote.data["amount"])
        self.assertEqual(
            receipt.data["processing_cost_contribution"],
            quote.data["processing_cost_contribution"],
        )
        self.assertEqual(receipt.data["total_amount"], quote.data["total_amount"])

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
        self.assertEqual(donation.donor_email_encrypted, "test@example.com")

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
        # Exercise DRF validation and the view; mock only the outbound Stripe
        # call in tests that must prove invalid input cannot start a payment.
        return MembershipPaymentSessionCreateView.as_view()(
            self.factory.post("/api/payments/membership/session/", data, format="json")
        )

    def donation_request(self, data):
        return PaymentSessionCreateView.as_view()(
            self.factory.post("/api/payments/session/", data, format="json")
        )

    @patch("donations.services.create_membership_payment_intent")
    def test_membership_id_rejects_non_strings_and_unavailable_options(self, create_intent):
        for option in (1, True, ["student"], {"id": "student"}, "unknown"):
            with self.subTest(option=option):
                response = self.membership_request(
                    {"membership_option_id": option, "payment_purpose": "membership"}
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("membership_option_id", response.data)
        create_intent.assert_not_called()

    @patch("donations.services.create_membership_payment_intent")
    def test_membership_rejects_price_currency_and_card_fields(self, create_intent):
        # Extra fields may include card data or a client secret. Neither the
        # response nor the Stripe call may contain their submitted values.
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
        # Even a syntactically valid reference is not authority to choose a
        # price: the referenced donation must exist before calling Stripe.
        response = self.donation_request(
            {"amount": "0.01", "currency": "usd", "payment_purpose": "Donation",
             "internal_reference": "DON-99999999"}
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        create_session.assert_not_called()


class PaymentSecurityRegressionTests(TestCase):
    """Exercise untrusted text and payment identifiers against real ORM rows."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.donation = Donation.objects.create(
            donor_first_name_encrypted="O'Connor", donor_last_name_encrypted="Anne-Marie",
            donor_email_encrypted="member@example.com", amount=Decimal("10.00"),
            donation_date=date.today(), is_anonymous=False, message="A normal message",
            reference_id="DON-00000001",
        )
        self.other = Donation.objects.create(
            donor_first_name_encrypted="Other", donor_last_name_encrypted="Person",
            donor_email_encrypted="other@example.com", amount=Decimal("20.00"),
            donation_date=date.today(), is_anonymous=False, message="Unrelated",
            reference_id="DON-00000002",
        )

    def session(self, reference, amount="10.00"):
        return PaymentSessionCreateView.as_view()(
            self.factory.post(
                "/api/payments/session/",
                {"amount": amount, "currency": "usd", "payment_purpose": "Donation",
                 "internal_reference": reference}, format="json",
            )
        )

    @patch("payments.views.create_payment_session")
    def test_sql_like_references_never_select_another_donation(self, create_session):
        # Quotation, SQL comments, Boolean expressions, and a valid prefix
        # followed by injected text must not broaden an exact ORM lookup.
        for suffix in ("' OR '1'='1", '" OR 1=1 --', "; DELETE FROM donations_donation; --",
                       " /* comment */"):
            with self.subTest(suffix=suffix):
                response = self.session(self.donation.reference_id + suffix)
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        create_session.assert_not_called()
        self.donation.refresh_from_db()
        self.other.refresh_from_db()
        self.assertEqual(self.donation.payment_status, Donation.PaymentStatus.PENDING)
        self.assertEqual(self.other.payment_status, Donation.PaymentStatus.PENDING)
        self.assertEqual(Donation.objects.count(), 2)

    @patch("payments.views.create_payment_session")
    def test_payment_text_fields_cannot_become_queries_or_stripe_metadata(self, create_session):
        base = {"amount": "10.00", "currency": "usd", "payment_purpose": "Donation",
                "internal_reference": self.donation.reference_id}
        for field in ("payment_purpose", "currency", "card_number", "client_secret"):
            with self.subTest(field=field):
                response = PaymentSessionCreateView.as_view()(
                    self.factory.post("/api/payments/session/",
                                      {**base, field: "' OR 1=1 --"}, format="json")
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertNotIn("' OR 1=1 --", str(response.data))
        create_session.assert_not_called()
        self.assertEqual(Donation.objects.count(), 2)

    @patch("donations.services.create_membership_payment_intent")
    def test_membership_payment_text_cannot_override_catalog_or_metadata(self, create_intent):
        base = {"membership_option_id": "student", "payment_purpose": "membership"}
        for field in ("membership_option_id", "payment_purpose", "amount", "currency",
                      "card_number", "security_code", "client_secret"):
            with self.subTest(field=field):
                response = MembershipPaymentSessionCreateView.as_view()(
                    self.factory.post("/api/payments/membership/session/",
                                      {**base, field: "' OR 1=1 --"}, format="json")
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertNotIn("' OR 1=1 --", str(response.data))
        create_intent.assert_not_called()

    def test_status_update_rejects_sql_like_reference_without_touching_rows(self):
        # Even internal callers must not use a webhook reference as a lookup
        # before checking its complete generated-ID format.
        with self.assertRaises(ValueError):
            _update_donation_payment_status(
                self.donation.reference_id + "' OR 1=1 --", Donation.PaymentStatus.COMPLETED
            )
        self.donation.refresh_from_db()
        self.other.refresh_from_db()
        self.assertEqual(self.donation.payment_status, Donation.PaymentStatus.PENDING)
        self.assertEqual(self.other.payment_status, Donation.PaymentStatus.PENDING)

    @patch("payments.views.Donation.objects.filter")
    def test_failed_payment_update_does_not_claim_success(self, filter_donations):
        # Simulate a write that affects no rows after the locked lookup.
        filter_donations.return_value.update.return_value = 0
        with self.assertRaises(DatabaseError):
            _update_donation_payment_status(
                self.donation.reference_id, Donation.PaymentStatus.COMPLETED
            )
        self.donation.refresh_from_db()
        self.assertEqual(self.donation.payment_status, Donation.PaymentStatus.PENDING)

    @patch("payments.views.stripe.Webhook.construct_event")
    def test_bad_webhook_signature_does_not_log_payload(self, construct_event):
        secret = "pi_private_client_secret_for_test"
        construct_event.side_effect = stripe.SignatureVerificationError(
            "bad signature " + secret, "sig_test"
        )
        request = self.factory.post(
            "/api/payments/webhook/", secret.encode(), content_type="application/json",
            HTTP_STRIPE_SIGNATURE="sig_test",
        )
        with self.assertLogs("payments.views", level="WARNING") as captured:
            response = StripeWebhookView.as_view()(request)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn(secret, str(response.data) + str(captured.output))
        self.assertEqual(Donation.objects.count(), 2)

    @patch("payments.views.stripe.Webhook.construct_event")
    def test_signed_event_with_sql_like_reference_cannot_update_donations(self, construct_event):
        event = Mock()
        event.to_dict.return_value = {
            "id": "evt_safe_test", "type": "payment_intent.succeeded",
            "data": {"object": {"metadata": {
                "internal_reference": self.donation.reference_id + "' OR 1=1 --"
            }}},
        }
        construct_event.return_value = event
        request = self.factory.post(
            "/api/payments/webhook/", b"{}", content_type="application/json",
            HTTP_STRIPE_SIGNATURE="sig_test",
        )
        with self.assertLogs("payments.views", level="WARNING"):
            response = StripeWebhookView.as_view()(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.donation.refresh_from_db()
        self.other.refresh_from_db()
        self.assertEqual(self.donation.payment_status, Donation.PaymentStatus.PENDING)
        self.assertEqual(self.other.payment_status, Donation.PaymentStatus.PENDING)

    @patch("payments.views.stripe.Webhook.construct_event")
    def test_signed_event_id_with_secret_or_newline_is_not_logged(self, construct_event):
        # Signature validation does not make arbitrary event metadata safe for
        # log formatting. Only the expected Stripe identifier shape is logged.
        secret = "pi_private_client_secret_for_test"
        event = Mock()
        event.to_dict.return_value = {
            "id": f"evt_test\n{secret}", "type": "payment_intent.succeeded",
            "data": {"object": {"metadata": {"internal_reference": "DON-99999999"}}},
        }
        construct_event.return_value = event
        request = self.factory.post(
            "/api/payments/webhook/", b"{}", content_type="application/json",
            HTTP_STRIPE_SIGNATURE="sig_test",
        )
        with self.assertLogs("payments.views", level="WARNING") as captured:
            response = StripeWebhookView.as_view()(request)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn(secret, str(response.data) + str(captured.output))
        self.assertIn("event_id=unavailable", str(captured.output))
        self.assertEqual(Donation.objects.count(), 2)
