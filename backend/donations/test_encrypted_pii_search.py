from datetime import date
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from config.encryption import EncryptedTextError
from donations.models import Donation, Membership
from donations.search import ENCRYPTED_PII_SEARCH_RESULT_LIMIT


class EncryptedPIISearchTests(TestCase):
    """Verify authorized, resource-isolated matching against encrypted destinations."""

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="search-admin@example.test", permissions_data={"Finances": True},
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.donation = self.create_donation()
        self.member = self.create_membership()
        self.cases = (
            (Donation, self.donation, "/api/donations/", "donation_id"),
            (Membership, self.member, "/api/donations/memberships/", "membership_id"),
        )

    def create_donation(self, **overrides):
        """Create searchable encrypted donation PII and out-of-scope metadata."""
        data = {
            "donor_first_name_encrypted": " Maya 松山 José ",
            "donor_last_name_encrypted": "ChenStraße",
            "donor_email_encrypted": "Maya.Private@example.test",
            "amount": 10, "donation_date": date(2026, 10, 21), "is_anonymous": False,
            "message": "MessageOnly", "reference_id": "ReferenceOnly",
        }
        data.update(overrides)
        return Donation.objects.create(**data)

    def create_membership(self, **overrides):
        """Create membership PII with formatted phone and Unicode names."""
        data = {
            "first_name_encrypted": " Maya 松山 José ",
            "last_name_encrypted": "ChenStraße", "email_encrypted": "Maya.Private@example.test",
            "phone_encrypted": "+1 (916) 555-0123", "membership_type": "student",
            "amount_paid": 20, "start_date": date(2026, 10, 21),
            "end_date": date(2027, 10, 20), "renewal_date": date(2027, 10, 21),
            "reference_id": "ReferenceOnly", "status": "pending", "notes": "NotesOnly",
        }
        data.update(overrides)
        return Membership.objects.create(**data)

    def test_partial_names_emails_unicode_case_and_whitespace(self):
        for _, record, url, pk_field in self.cases:
            for query in ("mAy", "  CHENSTR  ", "PRIVATE@EXAM", "松山", "JOSE\u0301",
                          "STRASSE", "maya 松山 josé chen", "chenstraße maya"):
                with self.subTest(url=url, query=query):
                    response = self.client.get(url, {"search": query})
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual([item[pk_field] for item in response.data], [record.pk])
                    self.assertNotIn("_encrypted", str(response.data))
                    self.assertNotIn("msscc:enc:", str(response.data))

    def test_phone_queries_ignore_formatting(self):
        for query in ("916555", "(916) 555", "+1-916-555-0123", "555.0123"):
            response = self.client.get("/api/donations/memberships/", {"search": query})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data[0]["membership_id"], self.member.pk)

    def test_nonmatches_and_out_of_scope_values_do_not_match(self):
        for _, _, url, _ in self.cases:
            for query in ("absent-person", "ReferenceOnly",
                          "MessageOnly", "NotesOnly", "000000", "---", "()"):
                response = self.client.get(url, {"search": query})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data, [])

    def test_unrelated_records_are_excluded(self):
        self.create_donation(
            donor_first_name_encrypted="Other", donor_last_name_encrypted="Person",
            donor_email_encrypted="other@example.test",
        )
        self.create_membership(
            first_name_encrypted="Other", last_name_encrypted="Person",
            email_encrypted="other@example.test", phone_encrypted="222222",
        )
        for _, record, url, pk_field in self.cases:
            response = self.client.get(url, {"search": "maya"})
            self.assertEqual([item[pk_field] for item in response.data], [record.pk])

    def test_blank_input_skips_search_scanner(self):
        for _, _, url, _ in self.cases:
            for query in ({}, {"search": ""}, {"search": " \t\n "}):
                with patch("donations.views.search_encrypted_pii") as scan:
                    response = self.client.get(url, query)
                self.assertEqual(response.status_code, 200)
                scan.assert_not_called()

    def test_unauthorized_search_does_not_scan_or_decrypt(self):
        for user, expected in ((None, 401), (self.user, 403)):
            self.user.permissions_data = {"Finances": False}
            self.client.force_authenticate(user=user)
            for _, _, url, _ in self.cases:
                with patch("donations.views.search_encrypted_pii") as scan, patch(
                    "config.fields.decrypt_text", side_effect=AssertionError("PII accessed"),
                ), self.assertLogs("django.request", level="WARNING") as logs:
                    response = self.client.get(url, {"search": "private-search-term"})
                self.assertEqual(response.status_code, expected)
                scan.assert_not_called()
                self.assertNotIn("private-search-term", str(response.data) + str(logs.output))

    def test_search_queries_only_the_requested_resource(self):
        for model, _, url, _ in self.cases:
            other = Membership if model is Donation else Donation
            with patch.object(other, "from_db", side_effect=AssertionError("Wrong resource")):
                with CaptureQueriesContext(connection) as queries:
                    response = self.client.get(url, {"search": "maya"})
            self.assertEqual(response.status_code, 200)
            for query in queries:
                self.assertNotIn(other._meta.db_table, query["sql"])
                self.assertNotIn(" LIKE ", query["sql"].upper())
                self.assertNotIn("maya", query["sql"].lower())
            scan_sql = queries[0]["sql"]
            legacy_field = "donor_first_name" if model is Donation else "first_name"
            self.assertNotIn(f'"{legacy_field}"', scan_sql)

    def test_search_bounds_matches_not_candidates_and_keeps_order(self):
        for _, _, url, pk_field in self.cases:
            with self.subTest(url=url):
                with patch("donations.search.ENCRYPTED_PII_SEARCH_RESULT_LIMIT", 1):
                    response = self.client.get(url, {"search": "maya"})
                self.assertEqual(len(response.data), 1)
                self.assertEqual(ENCRYPTED_PII_SEARCH_RESULT_LIMIT, 100)
                if pk_field == "donation_id":
                    late_match = self.create_donation(donation_date=date(2020, 1, 1))
                    Donation.objects.filter(pk=self.donation.pk).update(
                        donor_first_name_encrypted="Other", donor_last_name_encrypted="Other",
                        donor_email_encrypted="other@example.test",
                    )
                else:
                    late_match = self.create_membership(start_date=date(2020, 1, 1))
                    Membership.objects.filter(pk=self.member.pk).update(
                        first_name_encrypted="Other", last_name_encrypted="Other",
                        email_encrypted="other@example.test",
                    )
                with patch("donations.search.ENCRYPTED_PII_SEARCH_RESULT_LIMIT", 1):
                    response = self.client.get(url, {"search": "maya"})
                self.assertEqual([item[pk_field] for item in response.data], [late_match.pk])

    def test_filters_run_before_partial_search_and_exact_email_still_works(self):
        for _, _, url, _ in self.cases:
            response = self.client.get(url, {"search": "maya", "payment_status": "failed"})
            self.assertEqual(response.data, [])
            email_field = "donor_email" if url == "/api/donations/" else "email"
            response = self.client.get(url, {
                "search": "maya", email_field: "MAYA.PRIVATE@EXAMPLE.TEST",
            })
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(response.data), 1)

    def test_actual_limit_returns_first_100_matches_in_existing_order(self):
        for model, _, url, pk_field in self.cases:
            create = self.create_donation if model is Donation else self.create_membership
            for _ in range(101):
                create()
            expected = list(model.objects.values_list("pk", flat=True)[:100])
            response = self.client.get(url, {"search": "maya"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(response.data), 100)
            self.assertEqual([item[pk_field] for item in response.data], expected)

    def test_damaged_ciphertext_in_other_resource_is_not_loaded(self):
        for model, record, url, _ in self.cases:
            with self.subTest(url=url), connection.cursor() as cursor:
                field = "donor_email_encrypted" if model is Donation else "email_encrypted"
                cursor.execute(
                    f'UPDATE "{model._meta.db_table}" SET "{field}" = %s '
                    f'WHERE "{model._meta.pk.column}" = %s',
                    ["damaged-ciphertext", record.pk],
                )
                other_url = (
                    "/api/donations/memberships/" if model is Donation else "/api/donations/"
                )
                response = self.client.get(other_url, {"search": "maya"})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(len(response.data), 1)
                cursor.execute(
                    f'UPDATE "{model._meta.db_table}" SET "{field}" = NULL '
                    f'WHERE "{model._meta.pk.column}" = %s',
                    [record.pk],
                )

    def test_encryption_errors_are_sanitized_without_logging_search_or_pii(self):
        for _, _, url, _ in self.cases:
            with patch("config.fields.decrypt_text", side_effect=EncryptedTextError("private")):
                with self.assertLogs("donations.views", level="ERROR") as logs:
                    response = self.client.get(url, {"search": "sensitive-query"})
            self.assertEqual(response.status_code, 503)
            exposed = str(response.data) + str(logs.output)
            for sensitive in ("sensitive-query", "private", "Maya", "msscc:enc:",
                              *settings.FIELD_ENCRYPTION_KEYS):
                self.assertNotIn(sensitive, exposed)
