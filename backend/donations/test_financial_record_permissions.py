from datetime import date
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from donations.models import Donation, Membership


class FinancialRecordPermissionTests(TestCase):
    """Verify financial authorization before record lookup, search, or mutation."""

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="finance-admin@example.test", permissions_data={"Finances": True},
        )
        self.denied_user = get_user_model().objects.create_user(
            email="other-admin@example.test", is_staff=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.donation_data = {
            "donor_first_name": "Private Donor",
            "donor_last_name": "松山",
            "donor_email": "donor-private@example.test",
            "amount": "10.00", "is_anonymous": False, "message": "Private message",
        }
        self.membership_data = {
            "first_name": "Private Member", "last_name": "松山",
            "email": "member-private@example.test", "phone": "555-0188",
            "membership_type": "student", "amount_paid": "20.00",
            "start_date": "2026-10-21", "end_date": "2027-10-20",
            "renewal_date": "2027-10-21", "payment_status": "pending",
            "reference_id": "manual", "status": "pending", "notes": "Private notes",
        }
        self.donation = Donation.objects.create(
            donor_first_name_encrypted=self.donation_data["donor_first_name"],
            donor_last_name_encrypted=self.donation_data["donor_last_name"],
            donor_email_encrypted=self.donation_data["donor_email"],
            amount=10, donation_date=date(2026, 10, 21), is_anonymous=False,
            message="Private message", reference_id="DON-00000001",
        )
        self.membership = Membership.objects.create(
            **{
                f"{name}_encrypted" if name in ("first_name", "last_name", "email", "phone")
                else name: value
                for name, value in self.membership_data.items()
            },
        )
        self.cases = (
            (self.donation, "/api/donations/", "donor_email", self.donation_data),
            (self.membership, "/api/donations/memberships/", "email", self.membership_data),
        )

    def assert_denied_operations(self, user, expected_status):
        """Compare denial bodies without reading records or processing search terms."""
        self.client.force_authenticate(user=user)
        for record, url, email_field, data in self.cases:
            expected_body = None
            requests = [
                ("get", url, {}),
                ("get", url, {email_field: data[email_field]}),
                ("get", url, {email_field: "absent-person@example.test"}),
                ("get", url, {"search": "private-search-松山"}),
            ]
            for identifier in (record.pk, record.pk + 9999):
                for method in ("get", "put", "patch", "delete"):
                    requests.append((method, f"{url}{identifier}/", data))
            if isinstance(record, Membership):
                requests.append(("post", url, data))
            for method, endpoint, payload in requests:
                with self.subTest(model=type(record).__name__, method=method, url=endpoint):
                    with patch(
                        "donations.views.DonationListCreateView.get_queryset"
                    ) as donation_queryset, patch(
                        "donations.views.MembershipListCreateView.get_queryset"
                    ) as membership_queryset, patch(
                        "config.fields.decrypt_text", side_effect=AssertionError("PII loaded"),
                    ), self.assertLogs("django.request", level="WARNING") as logs:
                        with self.assertNumQueries(0):
                            response = getattr(self.client, method)(
                                endpoint, payload, format="json",
                            )
                    self.assertEqual(response.status_code, expected_status)
                    if expected_body is None:
                        expected_body = response.data
                    self.assertEqual(response.data, expected_body)
                    donation_queryset.assert_not_called()
                    membership_queryset.assert_not_called()
                    exposed = str(response.data) + str(logs.output)
                    sensitive = (
                        "msscc:enc:", "private-search-松山", "absent-person@example.test",
                        *settings.FIELD_ENCRYPTION_KEYS,
                        *(data[field] for field in data if "name" in field or "email" in field),
                        self.membership_data["phone"],
                    )
                    for value in sensitive:
                        self.assertNotIn(value, exposed)
            record.refresh_from_db()
            self.assertEqual(getattr(record, f"{email_field}_encrypted"), data[email_field])

    def test_anonymous_operations_are_denied_before_record_access(self):
        self.assert_denied_operations(None, 401)

    def test_staff_without_finances_is_denied_before_record_access(self):
        self.assert_denied_operations(self.denied_user, 403)

    def test_financial_admin_can_list_retrieve_and_search_decrypted_records(self):
        self.assertFalse(self.user.is_staff)
        for record, url, email_field, data in self.cases:
            for endpoint, query, is_list in (
                (url, {}, True),
                (f"{url}{record.pk}/", {}, False),
                (url, {email_field: data[email_field].upper()}, True),
            ):
                with self.subTest(url=endpoint, query=query):
                    response = self.client.get(endpoint, query)
                    self.assertEqual(response.status_code, 200)
                    result = response.data[0] if is_list else response.data
                    for field in data:
                        if "name" in field or "email" in field or field == "phone":
                            self.assertEqual(result[field], data[field])
                    self.assertNotIn("_encrypted", str(response.data))
                    self.assertNotIn("msscc:enc:", str(response.data))
            response = self.client.get(url, {email_field: "absent-person@example.test"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data, [])

    def test_financial_admin_can_update_patch_and_delete_records(self):
        for record, url, email_field, data in self.cases:
            endpoint = f"{url}{record.pk}/"
            updated = {**data, email_field: "updated-private@example.test"}
            response = self.client.put(endpoint, updated, format="json")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data[email_field], updated[email_field])
            response = self.client.patch(
                endpoint, {email_field: "patched-private@example.test"}, format="json",
            )
            self.assertEqual(response.status_code, 200)
            record.refresh_from_db()
            self.assertEqual(
                getattr(record, f"{email_field}_encrypted"), "patched-private@example.test",
            )
            self.assertEqual(self.client.delete(endpoint).status_code, 204)
            self.assertFalse(type(record).objects.filter(pk=record.pk).exists())

    def test_financial_admin_can_create_manual_membership(self):
        response = self.client.post(
            "/api/donations/memberships/", self.membership_data, format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["email"], self.membership_data["email"])

    def test_executive_retains_access_without_finances_flag(self):
        self.denied_user.is_executive = True
        self.denied_user.save(update_fields=["is_executive"])
        self.client.force_authenticate(user=self.denied_user)
        for record, url, email_field, data in self.cases:
            response = self.client.get(f"{url}{record.pk}/")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data[email_field], data[email_field])

    def test_missing_malformed_or_truthy_nonboolean_permissions_fail_closed(self):
        for permissions in ({}, {"Finances": False}, {"Finances": "true"},
                            {"Finances": 1}, ["Finances"], "Finances", None):
            self.user.permissions_data = permissions
            for _, url, _, _ in self.cases:
                with self.subTest(permissions=permissions, url=url):
                    self.assertEqual(self.client.get(url).status_code, 403)

    def test_inactive_financial_admin_is_denied(self):
        self.user.is_active = False
        for _, url, _, _ in self.cases:
            self.assertEqual(self.client.get(url).status_code, 403)

    def test_jwt_uses_current_database_permission_not_stale_claim(self):
        token = AccessToken.for_user(self.user)
        token["permissions_data"] = {"Finances": True}
        self.client.force_authenticate(user=None)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        for _, url, _, _ in self.cases:
            self.assertEqual(self.client.get(url).status_code, 200)
        self.user.permissions_data = {"Finances": False}
        self.user.save(update_fields=["permissions_data"])
        for _, url, _, _ in self.cases:
            self.assertEqual(self.client.get(url).status_code, 403)

    def test_donation_creation_remains_public_without_finances_permission(self):
        for user in (None, self.denied_user):
            self.client.force_authenticate(user=user)
            response = self.client.post("/api/donations/", self.donation_data, format="json")
            self.assertEqual(response.status_code, 201)

    @patch("donations.services.create_membership_payment_intent")
    def test_membership_checkout_remains_public_and_response_has_no_stored_pii(self, create):
        self.client.force_authenticate(user=None)
        create.return_value = {
            "session_id": "pi_test_finances", "client_secret": "pi_test_client_secret",
        }
        response = self.client.post("/api/payments/membership/session/", {
            **{field: self.membership_data[field]
               for field in ("first_name", "last_name", "email", "phone")},
            "membership_option_id": "student", "payment_purpose": "membership",
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            set(response.data), {"session_id", "client_secret", "confirmation_reference"},
        )
        self.assertNotIn("msscc:enc:", str(response.data))
        for field in ("first_name", "last_name", "email", "phone"):
            self.assertNotIn(self.membership_data[field], str(response.data))
