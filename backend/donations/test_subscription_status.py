from datetime import date
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import DatabaseError
from django.test import TestCase
from rest_framework.test import APIClient

from config.encryption import EncryptedTextError
from donations.models import Donation, Membership
from emails.models import Subscriber


class FinancialSubscriptionStatusTests(TestCase):
    """Verify normalized, read-only consent lookups behind financial authorization."""

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="finance-status@example.test", permissions_data={"Finances": True},
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.member = Membership.objects.create(
            email_encrypted="  STRASSE@Example.test  ", membership_type="individual",
            status="active", notes="", reference_id="manual",
        )
        self.donation = Donation.objects.create(
            donor_email_encrypted="  Straße@Example.test  ", amount=10,
            donation_date=date(2026, 11, 4), is_anonymous=True, reference_id="DON-status",
        )
        self.urls = [
            f"/api/donations/memberships/{self.member.pk}/subscription-status/",
            f"/api/donations/{self.donation.pk}/subscription-status/",
        ]

    def test_each_current_status_matches_normalized_email_without_writes_or_provider_calls(self):
        subscriber = Subscriber.objects.create(
            email="strasse@example.test", status="pending", source="footer",
        )
        for state in Subscriber.Status.values:
            Subscriber.objects.filter(pk=subscriber.pk).update(status=state)
            before = list(Subscriber.objects.values())
            with patch("emails.subscribers.subscribe_contact") as subscribe:
                with patch("emails.subscribers.get_provider") as provider:
                    for url in self.urls:
                        response = self.client.get(url)
                        self.assertEqual(response.status_code, 200)
                        self.assertEqual(response.data, {"status": state})
                        self.assertIn("no-store", response["Cache-Control"])
                provider.assert_not_called()
            subscribe.assert_not_called()
            self.assertEqual(list(Subscriber.objects.values()), before)

    def test_no_subscriber_is_not_an_unsubscribe_and_does_not_create_a_row(self):
        for url in self.urls:
            response = self.client.get(url)
            self.assertEqual(response.data, {"status": "not_recorded"})
        self.assertFalse(Subscriber.objects.exists())

    def test_financial_form_without_opt_in_does_not_unsubscribe_or_expose_status(self):
        subscriber = Subscriber.objects.create(
            email="strasse@example.test", status="subscribed", source="footer",
        )
        before = list(Subscriber.objects.values())
        self.client.force_authenticate(user=None)
        response = self.client.post("/api/donations/", {
            "donor_email": subscriber.email, "amount": "10.00", "is_anonymous": True,
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertNotIn("subscription_status", response.data)
        self.assertNotIn("subscriber", response.data)
        self.assertEqual(list(Subscriber.objects.values()), before)
        self.client.force_authenticate(user=self.user)
        url = f"/api/donations/{response.data['donation_id']}/subscription-status/"
        self.assertEqual(self.client.get(url).data, {"status": "subscribed"})

    def test_missing_email_is_distinct_and_does_not_query_subscribers(self):
        for value in (None, "", " \t "):
            Membership.objects.filter(pk=self.member.pk).update(email_encrypted=value)
            Donation.objects.filter(pk=self.donation.pk).update(donor_email_encrypted=value)
            with patch("donations.views.Subscriber.objects.filter") as lookup:
                for url in self.urls:
                    self.assertEqual(self.client.get(url).data, {"status": "email_unavailable"})
            lookup.assert_not_called()

    def test_database_and_decryption_failures_are_unavailable_not_absent(self):
        for target, error in (
            ("donations.views.Subscriber.objects.filter", DatabaseError("private-email")),
            ("config.fields.decrypt_text", EncryptedTextError("private-email")),
        ):
            for url in self.urls:
                with patch(target, side_effect=error):
                    with self.assertLogs("donations.views", level="ERROR") as logs:
                        response = self.client.get(url)
                self.assertEqual(response.status_code, 503)
                self.assertNotIn("private-email", str(response.data) + str(logs.output))

    def test_authorization_precedes_record_and_subscriber_access(self):
        denied = get_user_model().objects.create_user(email="denied-status@example.test")
        inactive = get_user_model().objects.create_user(
            email="inactive-status@example.test", is_active=False,
            permissions_data={"Finances": True},
        )
        for user, expected in ((None, 401), (denied, 403), (inactive, 403)):
            self.client.force_authenticate(user=user)
            with patch("config.fields.decrypt_text", side_effect=AssertionError("PII read")):
                with patch("donations.views.Subscriber.objects.filter") as lookup:
                    for url in self.urls:
                        self.assertEqual(self.client.get(url).status_code, expected)
                lookup.assert_not_called()

    def test_executive_can_read_and_mutating_methods_are_rejected(self):
        self.user.permissions_data = {}
        self.user.is_executive = True
        for url in self.urls:
            self.assertEqual(self.client.get(url).status_code, 200)
            for method in ("post", "put", "patch", "delete"):
                self.assertEqual(getattr(self.client, method)(url).status_code, 405)

    def test_missing_record_returns_not_found_not_no_subscription(self):
        self.member.delete()
        self.donation.delete()
        for url in self.urls:
            self.assertEqual(self.client.get(url).status_code, 404)
