import csv
from io import StringIO
from pathlib import Path

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from donations.donation_csv_contract import (
    DONATION_CSV_ANONYMITY_VALUES,
    DONATION_CSV_CURRENCY,
    DONATION_CSV_FIELD_LIMITS,
    DONATION_CSV_HEADERS,
    DONATION_CSV_PAYMENT_METHODS,
    DONATION_CSV_RECEIVED_STATUS,
    MAX_DONATION_CSV_BYTES,
    MAX_DONATION_CSV_ROWS,
    REQUIRED_DONATION_CSV_FIELDS,
    donation_csv_manual_input,
    donation_csv_template,
)
from donations.models import Donation
from donations.serializers import ManualDonationInputSerializer


class DonationCsvContractTests(TestCase):
    """Pin the donation-only template to received manual donation rules."""

    def test_headers_are_ordered_and_exclude_server_and_checkout_fields(self):
        # A matching filename is not enough: strict header ordering is the
        # guardrail against feeding an existing configurable export to import.
        self.assertEqual(DONATION_CSV_HEADERS, (
            "amount", "donation_date", "is_anonymous", "payment_method",
            "donor_first_name", "donor_last_name", "donor_email", "address",
            "external_reference", "message",
        ))
        self.assertEqual(REQUIRED_DONATION_CSV_FIELDS, DONATION_CSV_HEADERS[:3])
        self.assertEqual(set(DONATION_CSV_FIELD_LIMITS), set(DONATION_CSV_HEADERS))
        self.assertEqual(len(set(DONATION_CSV_HEADERS)), len(DONATION_CSV_HEADERS))
        self.assertTrue(set(DONATION_CSV_HEADERS).isdisjoint({
            "donation_id", "record_source", "payment_status", "currency", "reference_id",
            "stripe_payment_intent_id", "stripe_checkout_session_id", "receipt_sent_at",
            "contribute_to_processing_costs", "processing_cost_contribution", "total_amount",
            "mailing_list_consent", "donor_first_name_encrypted",
        }))

    def test_template_is_header_only_and_choices_match_manual_contract(self):
        # Keep the download free of donor data and verify manual-entry choices
        # cannot diverge from the instructions for offline payments.
        self.assertEqual(list(csv.reader(StringIO(donation_csv_template()))), [
            list(DONATION_CSV_HEADERS),
        ])
        self.assertTrue(donation_csv_template().endswith("\r\n"))
        self.assertEqual(DONATION_CSV_ANONYMITY_VALUES, ("true", "false"))
        self.assertEqual(DONATION_CSV_PAYMENT_METHODS, tuple(Donation.PaymentMethod.values))
        self.assertEqual(DONATION_CSV_PAYMENT_METHODS,
                         tuple(ManualDonationInputSerializer.PAYMENT_METHODS))
        self.assertEqual(DONATION_CSV_RECEIVED_STATUS, Donation.PaymentStatus.COMPLETED)
        self.assertEqual(DONATION_CSV_CURRENCY, "usd")
        self.assertEqual((MAX_DONATION_CSV_BYTES, MAX_DONATION_CSV_ROWS), (1_048_576, 500))
        self.assertEqual(DONATION_CSV_FIELD_LIMITS, {
            "amount": 11, "donation_date": 10, "is_anonymous": 5, "payment_method": 20,
            "donor_first_name": 255, "donor_last_name": 255, "donor_email": 254,
            "address": 500, "external_reference": 255, "message": 500,
        })

    def test_page_instructions_match_server_headers_limits_and_allowed_values(self):
        # Keep the independently maintained admin copy from drifting away from
        # the only server contract that will parse and validate uploaded files.
        page = (Path(__file__).resolve().parents[2]
                / "frontend/app/admin/donations/page.tsx").read_text(encoding="utf-8")
        self.assertIn(",".join(DONATION_CSV_HEADERS), page)
        self.assertIn("cash or check, or blank if unknown", page)
        self.assertIn("write exactly true or false", page)
        self.assertIn("always completed", page)
        self.assertIn("1,048,576 bytes and 500 data rows", page)
        self.assertIn("YYYY-MM-DD", page)
        self.assertIn("donor_email 254, address 500, external_reference 255, and message 500", page)

    def test_admin_guide_matches_contract_and_marks_later_work_as_planned(self):
        # Check the public-facing explanation against the server contract so
        # a reviewer does not accidentally follow a stale membership/export CSV.
        guide = (Path(__file__).resolve().parents[2]
                 / "docs/donation-csv-import.md").read_text(encoding="utf-8")
        self.assertIn(",".join(DONATION_CSV_HEADERS), guide)
        for value in DONATION_CSV_PAYMENT_METHODS + DONATION_CSV_ANONYMITY_VALUES:
            self.assertIn(f"`{value}`", guide)
        self.assertIn("1,048,576 bytes", guide)
        self.assertIn("500 data rows", guide)
        self.assertIn("SCRUM-881 provides the template download only", guide)
        self.assertIn("Neither is a CSV column", guide)

    def test_minimum_facts_and_optional_blanks_preserve_unknown_not_anonymous(self):
        # All examples are fictional and exist only inside isolated tests.
        row = {field: "" for field in DONATION_CSV_HEADERS}
        row.update(amount="35.00", donation_date="1990-01-02", is_anonymous="false")
        normalized = donation_csv_manual_input(row)
        serializer = ManualDonationInputSerializer(data=normalized)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        # No contact does not imply an anonymous gift, and previewing a row
        # through manual validation is not permission to create a database row.
        self.assertFalse(serializer.validated_data["is_anonymous"])
        for field in ("donor_first_name_encrypted", "donor_last_name_encrypted",
                      "donor_email_encrypted", "donor_address_encrypted", "payment_method"):
            self.assertIsNone(serializer.validated_data[field])
        self.assertEqual(serializer.validated_data["amount"].as_tuple().exponent, -2)
        self.assertEqual(Donation.objects.count(), 0)

    def test_required_amount_date_and_explicit_anonymity_are_not_guessed(self):
        row = {field: "" for field in DONATION_CSV_HEADERS}
        row.update(amount="35.00", donation_date="1990-01-02", is_anonymous="true",
                   donor_email="fake@example.test", payment_method="check")
        normalized = donation_csv_manual_input(row)
        serializer = ManualDonationInputSerializer(data=normalized)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertTrue(serializer.validated_data["is_anonymous"])
        self.assertEqual(serializer.validated_data["payment_method"], "check")
        self.assertEqual(serializer.validated_data["donor_email_encrypted"], "fake@example.test")
        for field in ("amount", "donation_date"):
            missing = {**row, field: ""}
            invalid = ManualDonationInputSerializer(data=donation_csv_manual_input(missing))
            self.assertFalse(invalid.is_valid())
            self.assertIn(field, invalid.errors)

    def test_unknown_anonymity_never_becomes_false(self):
        # A typo should be corrected by the uploader in C2, not quietly turned
        # into a saved non-anonymous record by Python's bool conversion.
        for value in ("", "unknown", "yes", "TRUE", "0"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                donation_csv_manual_input({"is_anonymous": value})


class DonationCsvTemplateEndpointTests(TestCase):
    """Protect the header-only download with active financial permission."""

    url = "/api/donations/import/template/"

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="donation-template-admin@example.test", permissions_data={"Finances": True},
        )
        self.client = APIClient()

    def test_only_active_finance_admins_download_without_creating_records(self):
        # Test the endpoint directly: hiding the button on a page cannot
        # replace backend authorization for anonymous or revoked accounts.
        self.assertEqual(self.client.get(self.url).status_code, 401)
        self.client.force_authenticate(user=self.user)
        for permissions, active in (({}, True), ({"Finances": False}, True),
                                    ({"Finances": True}, False)):
            self.user.permissions_data = permissions
            self.user.is_active = active
            self.assertEqual(self.client.get(self.url).status_code, 403)
        self.user.permissions_data = {"Finances": True}
        self.user.is_active = True
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content.decode("utf-8"), donation_csv_template())
        self.assertEqual(response["Content-Type"], "text/csv; charset=utf-8")
        self.assertEqual(response["Content-Disposition"],
                         'attachment; filename="donation-import-template.csv"')
        self.assertEqual(response["Cache-Control"], "no-store, private")
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertFalse(Donation.objects.exists())
