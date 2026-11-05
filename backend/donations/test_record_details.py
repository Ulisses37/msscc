from datetime import date
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from donations.models import Donation, Membership


class FinancialRecordDetailsTests(TestCase):
    """Expose stored drawer details only through authorized financial record reads."""

    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            email="finance-details@example.test", permissions_data={"Finances": True},
        )
        self.denied_user = get_user_model().objects.create_user(
            email="other-details@example.test", is_staff=True,
        )
        self.address = "123 Example Street\n松山市, 日本"
        self.member = Membership.objects.create(
            first_name_encrypted="Test", last_name_encrypted="Member",
            address_encrypted=self.address, membership_type="individual",
            membership_price="35.00", amount_paid="10.00", status="active",
            reference_id="manual-details", notes="",
        )
        self.donation = Donation.objects.create(
            donor_first_name_encrypted="Test", donor_last_name_encrypted="Donor",
            donor_email_encrypted="donor@example.test", donor_address_encrypted=self.address,
            amount="10.00", donation_date=date(2026, 11, 4), is_anonymous=False,
            reference_id="DON-details", message="",
        )

    def test_authorized_membership_list_and_detail_include_stored_price_and_origin(self):
        self.client.force_authenticate(user=self.user)
        for source in Membership.RecordSource.values:
            self.member.record_source = source
            self.member.save(update_fields=["record_source"])
            for url in (
                "/api/donations/memberships/",
                f"/api/donations/memberships/{self.member.pk}/",
            ):
                with self.subTest(source=source, url=url):
                    response = self.client.get(url)
                    self.assertEqual(response.status_code, 200)
                    data = response.data[0] if isinstance(response.data, list) else response.data
                    self.assertEqual(data["address"], self.address)
                    self.assertEqual(data["membership_price"], "35.00")
                    self.assertEqual(data["amount_paid"], "10.00")
                    self.assertEqual(data["record_source"], source)

    def test_authorized_donation_list_and_detail_include_multiline_address(self):
        self.client.force_authenticate(user=self.user)
        for url in ("/api/donations/", f"/api/donations/{self.donation.pk}/"):
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200)
            data = response.data[0] if isinstance(response.data, list) else response.data
            self.assertEqual(data["address"], self.address)

    def test_unauthorized_contact_reads_are_denied_before_decryption(self):
        for user, expected in ((None, 401), (self.denied_user, 403)):
            self.client.force_authenticate(user=user)
            for url in (
                "/api/donations/", f"/api/donations/{self.donation.pk}/",
                "/api/donations/memberships/",
                f"/api/donations/memberships/{self.member.pk}/",
            ):
                with self.subTest(user=user, url=url):
                    with patch(
                        "config.fields.decrypt_text", side_effect=AssertionError("PII read"),
                    ):
                        response = self.client.get(url)
                    self.assertEqual(response.status_code, expected)
                    self.assertNotIn(self.address, str(response.data))

    def test_public_donation_creation_does_not_echo_address(self):
        response = self.client.post("/api/donations/", {
            "donor_first_name": "Test", "donor_last_name": "Donor",
            "donor_email": "donor@example.test", "address": self.address,
            "amount": "10.00", "is_anonymous": False,
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertNotIn("address", response.data)
        self.assertNotIn(self.address, str(response.data))
