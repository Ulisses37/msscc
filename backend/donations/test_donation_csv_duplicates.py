"""Isolated warning criteria and authorized read-only preview integration."""

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from donations.donation_csv_duplicates import donation_duplicate_warnings
from donations.manual_donations import create_manual_donation
from donations.models import Donation
from donations.test_donation_csv_preview import csv_file, row


class DonationCsvDuplicateRuleTests(TestCase):
    """Warn on evidence without altering proposed or saved donations."""

    def proposal(self, csv_row, **overrides):
        """Use normalized backend values, not raw CSV cells, for comparisons."""
        values = {
            "amount": "35.00", "donation_date": "1990-01-02", "is_anonymous": False,
            "payment_method": None, "donor_first_name": None, "donor_last_name": None,
            "donor_email": None, "address": None, "external_reference": "", "message": "",
        }
        values.update(overrides)
        return {"row": csv_row, "values": values}

    def test_repeated_rows_warn_only_later_identical_facts(self):
        warnings = donation_duplicate_warnings([
            self.proposal(2), self.proposal(3), self.proposal(4),
            self.proposal(5, amount="35.01"), self.proposal(6, is_anonymous=True),
            self.proposal(7, payment_method="cash"),
        ])
        self.assertEqual([(item["row"], item["reason"]) for item in warnings],
                         [(3, "repeated_row"), (4, "repeated_row")])
        self.assertTrue(all("row 2" in item["message"] for item in warnings))

    def test_different_supported_date_spellings_match_after_preview_normalization(self):
        """An Excel-formatted copy must not evade the same-facts warning."""
        from donations.donation_csv_preview import parse_donation_csv

        preview = parse_donation_csv(csv_file(
            row(donation_date="01-02-1990"), row(donation_date="1990-01-02"),
            row(donation_date="01/02/1990"),
        ))
        self.assertEqual(preview["errors"], [])
        self.assertEqual([issue["row"] for issue in
                          donation_duplicate_warnings(preview["proposed_records"])], [3, 4])

    def test_existing_reference_and_name_require_matching_amount_and_date(self):
        saved = create_manual_donation({
            "amount": "35.00", "donation_date": "1990-01-02", "payment_method": "check",
            "donor_first_name": "Test", "donor_last_name": "Donor",
            "donor_email": "saved@example.test", "external_reference": "LEDGER-1",
        })
        warnings = donation_duplicate_warnings([
            self.proposal(2, external_reference=" ledger-1 ", donor_first_name=" test ",
                          donor_last_name="DONOR"),
            self.proposal(3, external_reference="LEDGER-1", amount="35.01"),
            self.proposal(4, external_reference="LEDGER-1", donation_date="1990-01-03"),
            self.proposal(5, donor_email="saved@example.test"),
            self.proposal(6, donor_first_name="Test"),
            self.proposal(7, is_anonymous=True, external_reference="LEDGER-1"),
        ])
        self.assertEqual({(item["row"], item["reason"]) for item in warnings}, {
            (2, "existing_reference_amount_date"), (2, "existing_name_amount_date"),
            (7, "existing_reference_amount_date"),
        })
        self.assertNotIn("saved@example.test", str(warnings))
        self.assertEqual(Donation.objects.count(), 1)
        saved.refresh_from_db()
        self.assertEqual(saved.external_reference, "LEDGER-1")

    def test_unknown_and_anonymous_names_never_impersonate_identity_evidence(self):
        create_manual_donation({"amount": "35.00", "donation_date": "1990-01-02",
                                "is_anonymous": True, "donor_email": "private@example.test"})
        warnings = donation_duplicate_warnings([
            self.proposal(2, is_anonymous=True, donor_email="private@example.test"),
            self.proposal(3),
        ])
        self.assertEqual(warnings, [])


class DonationCsvDuplicateEndpointTests(TestCase):
    """Only finance-authorized uploads can trigger saved-record comparisons."""

    url = "/api/donations/import/preview/"

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="donation-warning-admin@example.test", permissions_data={"Finances": True},
        )
        self.client = APIClient()

    def upload(self, *rows):
        """Exercise actual multipart parsing and warning lookup."""
        return self.client.post(self.url, {"file": SimpleUploadedFile(
            "donations.csv", csv_file(*rows), content_type="text/csv",
        )}, format="multipart")

    def test_warnings_require_authorization_and_preview_does_not_save(self):
        create_manual_donation({"amount": "35.00", "donation_date": "1990-01-02",
                                "external_reference": "LEDGER-1"})
        rows = (row(external_reference="LEDGER-1"), row(external_reference="LEDGER-1"))
        for user, active, expected in ((None, True, 401), (self.user, False, 403),
                                       (self.user, True, 403)):
            self.user.is_active = active
            self.user.permissions_data = {} if active else {"Finances": True}
            self.client.force_authenticate(user=user)
            response = self.upload(*rows)
            self.assertEqual(response.status_code, expected)
            self.assertNotIn("LEDGER-1", str(response.data))
        self.user.is_active = True
        self.user.permissions_data = {"Finances": True}
        self.client.force_authenticate(user=self.user)
        response = self.upload(*rows)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "no-store, private")
        self.assertEqual(response.data["row_count"], 2)
        self.assertEqual({item["reason"] for item in response.data["warnings"]},
                         {"repeated_row", "existing_reference_amount_date"})
        # A valid review can be confirmed only with its signed warning set;
        # issuing that token does not save the existing or proposed donations.
        self.assertTrue(response.data["review_token"])
        self.assertEqual(Donation.objects.count(), 1)

    def test_invalid_rows_are_never_compared_and_email_alone_is_not_evidence(self):
        create_manual_donation({"amount": "35.00", "donation_date": "1990-01-02",
                                "donor_email": "saved@example.test"})
        self.client.force_authenticate(user=self.user)
        response = self.upload(row(donor_email="saved@example.test"), row(amount="0.00"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["warnings"], [])
        self.assertEqual(response.data["errors"][0]["field"], "amount")
        self.assertEqual(len(response.data["proposed_records"]), 1)
