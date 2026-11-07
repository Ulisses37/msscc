"""Isolated rule and endpoint tests for the read-only donation import preview."""

import csv
from datetime import date
from io import StringIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from donations.donation_csv_contract import (
    DONATION_CSV_FIELD_LIMITS,
    DONATION_CSV_HEADERS,
    MAX_DONATION_CSV_BYTES,
    MAX_DONATION_CSV_ROWS,
    donation_csv_template,
)
from donations.donation_csv_preview import parse_donation_csv
from donations.models import Donation


def csv_file(*rows, headers=DONATION_CSV_HEADERS, newline="\r\n"):
    """Build a strict CSV while preserving commas and multiline quoted cells."""
    buffer = StringIO(newline="")
    writer = csv.writer(buffer, lineterminator=newline)
    writer.writerow(headers)
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8")


def row(**overrides):
    """Vary one financial fact at a time using the fixed template order."""
    facts = {"amount": "35.00", "donation_date": "1990-01-02", "is_anonymous": "false"}
    facts.update(overrides)
    return [facts.get(header, "") for header in DONATION_CSV_HEADERS]


class DonationCsvParserTests(TestCase):
    """Validate structure and received facts without touching persistent data."""

    def test_money_and_choice_variants_normalize_without_inventing_facts(self):
        """Excel's one-decimal amounts and case changes retain their financial meaning."""
        preview = parse_donation_csv(csv_file(
            row(amount="1", payment_method="Cash", is_anonymous=" FALSE "),
            row(amount="2.5", payment_method=" check ", is_anonymous="TRUE"),
            row(amount="3.50", payment_method="", is_anonymous="TrUe"),
        ))
        self.assertEqual(preview["errors"], [])
        self.assertEqual([p["values"]["amount"] for p in preview["proposed_records"]],
                         ["1.00", "2.50", "3.50"])
        self.assertEqual([p["values"]["payment_method"] for p in preview["proposed_records"]],
                         ["cash", "check", None])
        self.assertFalse(Donation.objects.exists())

    def test_errors_distinguish_missing_invalid_and_private_values(self):
        """Show safe corrections, but never a private value pasted in the wrong cell."""
        preview = parse_donation_csv(csv_file(
            row(amount="", payment_method="Paid"),
            row(amount="2020-10-11", donation_date="", is_anonymous="yes"),
            row(amount="0", donation_date="02/29/2025", payment_method="card"),
            row(payment_method="Private Donor", donor_email="private-invalid-email"),
        ))
        messages = {(e["row"], e["field"]): e["message"] for e in preview["errors"]}
        self.assertIn("required", messages[2, "amount"])
        self.assertIn("spreadsheet date", messages[3, "amount"])
        self.assertIn("known donation date", messages[3, "donation_date"])
        self.assertIn("real, non-future", messages[4, "donation_date"])
        self.assertIn("cash, check", messages[2, "payment_method"])
        self.assertIn('"paid"', messages[2, "payment_method"])
        self.assertIn("valid email", messages[5, "donor_email"])
        self.assertNotIn("Private Donor", str(preview["errors"]))
        self.assertNotIn("private-invalid-email", str(preview["errors"]))
        self.assertEqual(preview["proposed_records"], [])

    def test_bom_quoting_line_endings_and_normalized_values(self):
        for newline, bom in (("\r\n", b""), ("\n", b"\xef\xbb\xbf")):
            with self.subTest(newline=newline, bom=bool(bom)):
                preview = parse_donation_csv(bom + csv_file(row(
                    amount="35", donor_first_name="  Test ", donor_email=" TEST@EXAMPLE.TEST ",
                    message="First, line\nSecond line", payment_method="check",
                ), newline=newline))
                self.assertEqual(preview["errors"], [])
                self.assertEqual(preview["record_type"], "donation")
                self.assertEqual(preview["row_count"], 1)
                proposal = preview["proposed_records"][0]
                self.assertEqual(proposal["row"], 2)
                self.assertEqual(proposal["values"], {
                    "amount": "35.00", "donation_date": "1990-01-02", "is_anonymous": False,
                    "payment_method": "check", "donor_first_name": "Test", "donor_last_name": None,
                    "donor_email": "test@example.test", "address": None, "external_reference": "",
                    "message": "First, line\nSecond line",
                })
                self.assertFalse(Donation.objects.exists())

    def test_excel_us_date_normalizes_to_the_same_known_iso_date(self):
        """Excel's fixed-width US export must not change the reviewed gift date."""
        preview = parse_donation_csv(csv_file(
            row(donation_date="01-02-1990"),
            row(donation_date="1990-01-02"),
            row(donation_date="12-31-2020"),
            row(donation_date="10/11/2020"),
            row(donation_date="10-11-2020"),
        ))
        self.assertEqual(preview["errors"], [])
        self.assertEqual([proposal["values"]["donation_date"]
                          for proposal in preview["proposed_records"]],
                         ["1990-01-02", "1990-01-02", "2020-12-31",
                          "2020-10-11", "2020-10-11"])
        self.assertFalse(Donation.objects.exists())

    def test_excel_date_rejects_ambiguous_invalid_missing_and_future_values(self):
        """Never infer a locale, roll over a date, or invent an unknown fact."""
        for value in ("", "1-02-1990", "01-2-1990", "1/2/1990", "2020/10/11",
                      "10-11/2020", "10/11-2020", "31-12-2020", "02-29-2025",
                      "02/29/2025", "13-01-2020", "00-12-2020", "11-05-2026",
                      "11/05/2026", "01-02-1990 00:00:00"):
            with self.subTest(value=value), \
                 patch("donations.serializers.timezone.localdate",
                       return_value=date(2026, 11, 4)):
                preview = parse_donation_csv(csv_file(row(donation_date=value)))
                self.assertEqual(preview["proposed_records"], [])
                self.assertIn("donation_date", {e["field"] for e in preview["errors"]})
                if value and value not in ("11-05-2026", "11/05/2026"):
                    self.assertNotIn(value, str(preview["errors"]))

        # An actual leap day is valid in either supported spelling.
        valid = parse_donation_csv(csv_file(row(donation_date="02-29-2024")))
        self.assertEqual(valid["errors"], [])
        self.assertEqual(valid["proposed_records"][0]["values"]["donation_date"],
                         "2024-02-29")
        with_slash = parse_donation_csv(csv_file(row(donation_date="02/29/2024")))
        self.assertEqual(with_slash["errors"], [])
        self.assertEqual(with_slash["proposed_records"][0]["values"]["donation_date"],
                         "2024-02-29")

    def test_headers_empty_malformed_encoding_and_column_count(self):
        cases = (
            (b"", "file"), (b"\xff", "file"), (b"garbage", "header"),
            (donation_csv_template().encode(), "file"),
            (csv_file(row(), headers=DONATION_CSV_HEADERS[::-1]), "header"),
            (csv_file(row(), headers=(*DONATION_CSV_HEADERS[:-1], "amount")), "header"),
            (csv_file(row(), headers=(*DONATION_CSV_HEADERS, "extra")), "header"),
            (csv_file(row()[:-1]), "row"), (csv_file([*row(), "extra"]), "row"),
            (csv_file([]), "row"), (csv_file(row(message="a\x00b")), "file"),
            (donation_csv_template().encode() + b'35.00,1990-01-02,false,"unfinished', "file"),
        )
        for raw, field in cases:
            with self.subTest(field=field, raw=raw[:32]):
                preview = parse_donation_csv(raw)
                self.assertTrue(preview["errors"])
                self.assertIn(field, {error["field"] for error in preview["errors"]})
                self.assertEqual(preview["proposed_records"], [])

    def test_byte_row_and_cell_bounds(self):
        self.assertIn("file", {error["field"] for error in
                             parse_donation_csv(b"x" * (MAX_DONATION_CSV_BYTES + 1))["errors"]})
        for field in DONATION_CSV_HEADERS:
            with self.subTest(field=field):
                preview = parse_donation_csv(csv_file(row(**{
                    field: "x" * (DONATION_CSV_FIELD_LIMITS[field] + 1),
                })))
                self.assertIn(field, {error["field"] for error in preview["errors"]})
        preview = parse_donation_csv(csv_file(*(row() for _ in range(MAX_DONATION_CSV_ROWS + 1))))
        self.assertEqual(preview["row_count"], MAX_DONATION_CSV_ROWS + 1)
        self.assertIn("file", {error["field"] for error in preview["errors"]})
        self.assertEqual(len(parse_donation_csv(csv_file(
            *(row() for _ in range(MAX_DONATION_CSV_ROWS)),
        ))["proposed_records"]), MAX_DONATION_CSV_ROWS)

    def test_invalid_amounts_dates_choices_and_contacts_have_safe_field_errors(self):
        for field, values in (
            ("amount", ("", "0", "0.00", "-1", "1.001", "1,000", "$1", "1e2",
                        "100000000.00", "NaN")),
            ("donation_date", ("", "2025-02-29", "2020-13-01", "not-a-date",
                               "2026-11-05", "2026-11-04T00:00:00Z")),
            ("is_anonymous", ("", " ", "yes", "0", "private-unknown-choice")),
            ("payment_method", ("card", "unknown", "Paid")),
            ("donor_email", ("private-invalid-email",)),
        ):
            for value in values:
                with self.subTest(field=field, value=value), \
                     patch("donations.serializers.timezone.localdate",
                           return_value=date(2026, 11, 4)):
                    preview = parse_donation_csv(csv_file(row(**{field: value})))
                    self.assertIn(field, {error["field"] for error in preview["errors"]})
                    # A single space is normal in fixed error prose; the
                    # privacy assertion is meaningful for nonblank cell text.
                    if value.strip() and value.strip().casefold() not in {
                        "card", "unknown", "paid", "yes",
                    }:
                        self.assertNotIn(value, str(preview["errors"]))
                    self.assertEqual(preview["proposed_records"], [])

    def test_spreadsheet_boolean_whitespace_is_accepted_but_missing_dates_are_not(self):
        """Normalize explicit booleans without guessing a historical date."""
        preview = parse_donation_csv(csv_file(
            row(donation_date="", is_anonymous="false "),
            row(donation_date="", is_anonymous="TRUE "),
            row(donation_date="", is_anonymous=" true "),
        ))
        self.assertEqual(preview["row_count"], 3)
        self.assertEqual(preview["proposed_records"], [])
        self.assertEqual(len(preview["errors"]), 3)
        for csv_row in (2, 3, 4):
            self.assertEqual({(issue["field"], issue["message"])
                              for issue in preview["errors"] if issue["row"] == csv_row}, {
                ("donation_date", "A known donation date is required "
                 "(YYYY-MM-DD, MM-DD-YYYY or MM/DD/YYYY)."),
            })
        # Other overlong/unknown strings must retain their generic safe
        # diagnostics; we must not expose uploaded values in an error reply.
        oversized = parse_donation_csv(csv_file(row(is_anonymous="private-" * 5)))
        self.assertEqual(oversized["errors"][0]["message"],
                         "Use at most 32 characters.")
        self.assertNotIn("private-", str(oversized["errors"]))
        padded = parse_donation_csv(csv_file(row(is_anonymous=" " * 32 + "true")))
        self.assertEqual(padded["errors"][0]["message"],
                         "Use at most 32 characters.")
        unknown = parse_donation_csv(csv_file(row(is_anonymous="yes")))
        self.assertEqual(unknown["errors"][0]["message"],
                         '"yes" is not recognized. Use one of: true, false.')
        # Diagnostics do not soften validation: only an explicit boolean and
        # actual received date can produce a reviewable proposal.
        fixed = parse_donation_csv(csv_file(row(donation_date="1990-01-02",
                                                   is_anonymous=" FALSE ")))
        self.assertEqual(fixed["errors"], [])
        self.assertEqual(len(fixed["proposed_records"]), 1)
        self.assertIs(fixed["proposed_records"][0]["values"]["is_anonymous"], False)

    def test_normalized_true_still_blocks_anonymous_names_and_address(self):
        preview = parse_donation_csv(csv_file(row(
            is_anonymous=" TRUE ", donor_first_name="Private", address="Private street",
        )))
        self.assertEqual({error["field"] for error in preview["errors"]},
                         {"donor_first_name", "address"})
        self.assertEqual(preview["proposed_records"], [])

    def test_anonymous_names_and_address_require_correction_not_silent_discard(self):
        preview = parse_donation_csv(csv_file(row(
            is_anonymous="true", donor_first_name="Private", donor_last_name="Identity",
            address="Private street", donor_email="ANON@EXAMPLE.TEST",
        )))
        self.assertEqual({error["field"] for error in preview["errors"]},
                         {"donor_first_name", "donor_last_name", "address"})
        self.assertEqual(preview["proposed_records"], [])
        self.assertNotIn("Private", str(preview["errors"]))
        allowed = parse_donation_csv(csv_file(row(
            is_anonymous="true", donor_email="ANON@EXAMPLE.TEST",
        )))
        self.assertEqual(allowed["errors"], [])
        self.assertTrue(allowed["proposed_records"][0]["values"]["is_anonymous"])
        self.assertEqual(allowed["proposed_records"][0]["values"]["donor_email"],
                         "anon@example.test")

    def test_error_rows_follow_physical_csv_lines_after_quoted_newlines(self):
        # A quoted multiline note consumes two physical lines. The next row's
        # diagnostic must point to the line an admin can find in the source CSV.
        preview = parse_donation_csv(csv_file(
            row(message="First line\nSecond line"), row(amount="0.00"),
        ))
        self.assertEqual(preview["row_count"], 2)
        self.assertEqual([item["row"] for item in preview["proposed_records"]], [2])
        self.assertEqual([(item["row"], item["field"]) for item in preview["errors"]],
                         [(4, "amount")])

    def test_malformed_trailing_row_discards_earlier_proposals(self):
        # Once quote parsing fails, showing earlier rows as a partial import
        # would misrepresent the batch the admin uploaded.
        raw = csv_file(row()) + b'35.00,1990-01-02,false,"unterminated'
        preview = parse_donation_csv(raw)
        self.assertEqual(preview["proposed_records"], [])
        self.assertIn("file", {item["field"] for item in preview["errors"]})

    def test_blank_optional_contacts_do_not_imply_anonymity_and_text_is_not_executed(self):
        preview = parse_donation_csv(csv_file(row(message="<script>alert(1)</script>")))
        self.assertEqual(preview["errors"], [])
        values = preview["proposed_records"][0]["values"]
        self.assertFalse(values["is_anonymous"])
        self.assertIsNone(values["donor_first_name"])
        self.assertIsNone(values["payment_method"])
        self.assertEqual(values["message"], "<script>alert(1)</script>")
        self.assertFalse(Donation.objects.exists())


class DonationCsvPreviewEndpointTests(TestCase):
    """Require finance authorization and prove preview does not create donations."""

    url = "/api/donations/import/preview/"

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="donation-csv-admin@example.test", permissions_data={"Finances": True},
        )
        self.client = APIClient()

    def post_csv(self, raw=None):
        """Send a fictional multipart file through the real request boundary."""
        return self.client.post(self.url, {"file": SimpleUploadedFile(
            "donation.csv", csv_file(row()) if raw is None else raw, content_type="text/csv",
        )}, format="multipart")

    def test_denied_callers_never_parse_or_receive_contacts(self):
        for permissions, active, expected in ((None, True, 401), ({}, True, 403),
                                              ({"Finances": False}, True, 403),
                                              ({"Finances": True}, False, 403)):
            with self.subTest(expected=expected, active=active):
                self.user.permissions_data = permissions or {}
                self.user.is_active = active
                self.client.force_authenticate(user=self.user if permissions is not None else None)
                with patch("donations.donation_import_views.parse_donation_csv") as parse:
                    response = self.post_csv(csv_file(row(donor_email="private@example.test")))
                self.assertEqual(response.status_code, expected)
                self.assertNotIn("private@example.test", str(response.data))
                parse.assert_not_called()

    def test_authorized_preview_is_private_and_creates_no_records_or_external_actions(self):
        self.client.force_authenticate(user=self.user)
        with patch("donations.manual_donations._persist_manual_donation") as save, \
             patch("donations.manual_donations.create_manual_donation") as create, \
             patch("donations.receipts.send_donation_receipt") as receipt, \
             patch("payments.services.stripe_service.create_payment_session") as payment:
            response = self.post_csv(csv_file(row(donor_email="TEST@EXAMPLE.TEST")))
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response["Cache-Control"], "no-store, private")
        self.assertEqual(response.data["record_type"], "donation")
        self.assertEqual(response.data["row_count"], 1)
        self.assertEqual(response.data["errors"], [])
        self.assertEqual(response.data["proposed_records"][0]["values"]["donor_email"],
                         "test@example.test")
        # A valid, finance-authorized review now includes a signed prerequisite;
        # merely issuing it still cannot persist any donation.
        # SCRUM-883 adds warning results; a single valid row without existing
        # evidence must return an empty list, not invent a duplicate.
        self.assertEqual(response.data["warnings"], [])
        self.assertTrue(response.data["review_token"])
        self.assertFalse(Donation.objects.exists())
        save.assert_not_called()
        create.assert_not_called()
        receipt.assert_not_called()
        payment.assert_not_called()

    def test_missing_multiple_and_oversized_uploads_fail_without_writes(self):
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.post(self.url, {}, format="multipart").status_code, 400)
        response = self.client.post(self.url, {
            "file": SimpleUploadedFile("one.csv", csv_file(row())),
            "extra": SimpleUploadedFile("two.csv", csv_file(row())),
        }, format="multipart")
        self.assertEqual(response.status_code, 400)
        # Repeated file keys are not the same as distinct dictionary keys:
        # Django otherwise exposes only the last upload through .get().
        response = self.client.post(self.url, {
            "file": [SimpleUploadedFile("one.csv", csv_file(row())),
                     SimpleUploadedFile("two.csv", csv_file(row()))],
        }, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.post_csv(b"x" * (MAX_DONATION_CSV_BYTES + 1)).status_code, 400)
        self.assertFalse(Donation.objects.exists())

    def test_private_invalid_values_never_appear_in_error_response_or_logs(self):
        self.client.force_authenticate(user=self.user)
        with self.assertLogs("django.request", level="WARNING") as captured:
            response = self.post_csv(csv_file(row(donor_email="private-invalid-email")))
            # A malformed multipart request is not required here: invalid CSV
            # gets a safe 200 preview, not a logged request exception.
            self.client.post(self.url, {}, format="multipart")
        self.assertEqual(response.status_code, 200)
        self.assertIn("donor_email", {e["field"] for e in response.data["errors"]})
        self.assertNotIn("private-invalid-email", str(response.data["errors"]))
        self.assertNotIn("private-invalid-email", str(captured.output))
        self.assertFalse(Donation.objects.exists())
