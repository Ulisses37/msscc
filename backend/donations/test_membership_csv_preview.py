import csv
from io import StringIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from donations.membership_csv_contract import (
    MAX_MEMBERSHIP_CSV_BYTES,
    MAX_MEMBERSHIP_CSV_ROWS,
    MEMBERSHIP_CSV_FIELD_LIMITS,
    MEMBERSHIP_CSV_HEADERS,
    membership_csv_template,
)
from donations.membership_csv_preview import parse_membership_csv
from donations.models import Membership


def csv_file(*rows, headers=MEMBERSHIP_CSV_HEADERS, newline="\r\n"):
    """Generate strict CSV fixtures, including quoted content and embedded newlines."""
    buffer = StringIO(newline="")
    writer = csv.writer(buffer, lineterminator=newline)
    writer.writerow(headers)
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8")


def row(**values):
    """Keep fixtures aligned with the template while varying one historical fact."""
    facts = {"first_name": "Test", "last_name": "Member", "membership_type": "Life",
             "status": "unknown"}
    facts.update(values)
    return [facts.get(field, "") for field in MEMBERSHIP_CSV_HEADERS]


class MembershipCsvParserTests(TestCase):
    """Exercise byte, structural and rule-level validation without persisting."""

    def test_bom_windows_unix_quoting_newlines_and_normalized_proposals(self):
        for newline, bom in (("\r\n", b""), ("\n", b"\xef\xbb\xbf")):
            with self.subTest(newline=newline, bom=bool(bom)):
                result = parse_membership_csv(bom + csv_file(row(
                    first_name="  松山  ", last_name="O'Neil", email="  MEMBER@EXAMPLE.TEST ",
                    notes="Line one, with comma\nLine two", amount_paid="0.00",
                    start_date="1999-01-01", payment_status="waived", payment_method="check",
                ), newline=newline))
                self.assertEqual(result["errors"], [])
                self.assertEqual(result["row_count"], 1)
                self.assertEqual(result["proposed_records"][0]["row"], 2)
                values = result["proposed_records"][0]["values"]
                self.assertEqual(values["first_name"], "松山")
                self.assertEqual(values["email"], "member@example.test")
                self.assertEqual(values["notes"], "Line one, with comma\nLine two")
                self.assertEqual(values["amount_paid"], "0.00")
                self.assertEqual(values["start_date"], "1999-01-01")
                self.assertIsNone(values["end_date"])
                self.assertIsNone(values["membership_price"])
                self.assertIsNone(values["renewal_date"])
                self.assertEqual(values["payment_method"], "check")
                self.assertNotIn("record_source", values)
                self.assertNotIn("membership_id", values)

    def test_excel_and_iso_dates_with_slashes_or_dashes_normalize_to_iso(self):
        # Excel's US ordering is accepted only for CSV imports; all proposals
        # use ISO dates so review, fingerprinting and persistence agree.
        for start, end, renewal in (
            ("2024-01-02", "2024-02-03", "2024-03-04"),
            ("2024/01/02", "2024/02/03", "2024/03/04"),
            ("01/02/2024", "02/03/2024", "03/04/2024"),
            ("01-02-2024", "02-03-2024", "03-04-2024"),
            ("2024-01-02", "02/03/2024", "2024/03/04"),
        ):
            with self.subTest(start=start, end=end, renewal=renewal):
                result = parse_membership_csv(csv_file(row(
                    start_date=start, end_date=end, renewal_date=renewal,
                )))
                self.assertEqual(result["errors"], [])
                self.assertEqual(result["proposed_records"][0]["values"]["start_date"],
                                 "2024-01-02")
                self.assertEqual(result["proposed_records"][0]["values"]["end_date"],
                                 "2024-02-03")
                self.assertEqual(result["proposed_records"][0]["values"]["renewal_date"],
                                 "2024-03-04")

    def test_rejects_ambiguous_or_invalid_calendar_dates_without_reflecting_values(self):
        for value in ("2024-1-02", "1/02/2024", "2024/01-02", "01-02/2024",
                      "2024-02-30", "02/30/2024", "13/02/2024", "11/31/2024",
                      "2024/00/01", "00-01-2024", "01/02/24", "45293"):
            with self.subTest(date=value):
                result = parse_membership_csv(csv_file(row(start_date=value)))
                self.assertTrue(any(error["row"] == 2 and error["field"] == "start_date"
                                    for error in result["errors"]))
                self.assertEqual(result["proposed_records"], [])
                self.assertNotIn(value, str(result["errors"]))

    def test_rejects_missing_or_wrong_headers_and_empty_files(self):
        for raw in (b"", b"garbage", membership_csv_template().encode(),
                    csv_file(row(), headers=MEMBERSHIP_CSV_HEADERS[::-1]),
                    csv_file(row(), headers=(*MEMBERSHIP_CSV_HEADERS[:-1], "first_name")),
                    csv_file(row(), headers=(*MEMBERSHIP_CSV_HEADERS, "extra"))):
            with self.subTest(length=len(raw)):
                self.assertTrue(parse_membership_csv(raw)["errors"])
        self.assertEqual(parse_membership_csv(membership_csv_template().encode())["row_count"], 0)

    def test_limits_invalid_encoding_and_malformed_quote(self):
        for raw, field in ((b"\xff", "file"), (b"a\x00b", "file"),
                           (b"x" * (MAX_MEMBERSHIP_CSV_BYTES + 1), "file"),
                           (csv_file(row()) + b'"unterminated', "file")):
            with self.subTest(field=field):
                self.assertTrue(any(
                    e["field"] == field for e in parse_membership_csv(raw)["errors"]
                ))
        many = parse_membership_csv(csv_file(*([row()] * (MAX_MEMBERSHIP_CSV_ROWS + 1))))
        self.assertEqual(many["row_count"], 501)
        self.assertTrue(any(e["message"] == "CSV may contain at most 500 data rows."
                            for e in many["errors"]))
        accepted = parse_membership_csv(csv_file(*([row()] * MAX_MEMBERSHIP_CSV_ROWS)))
        self.assertEqual(accepted["row_count"], 500)
        self.assertEqual(accepted["errors"], [])

    def test_column_count_and_field_limits_identify_rows(self):
        result = parse_membership_csv(csv_file(
            row(), ["Too", "few"], [], row(notes="x" * 501),
        ))
        self.assertEqual(result["row_count"], 4)
        self.assertIn({"row": 3, "field": "row",
                       "message": "Row must have exactly 16 columns and cannot be blank."},
                      result["errors"])
        self.assertIn({"row": 4, "field": "row",
                       "message": "Row must have exactly 16 columns and cannot be blank."},
                      result["errors"])
        self.assertIn({"row": 5, "field": "notes", "message": "Use at most 500 characters."},
                      result["errors"])

    def test_csv_choice_case_and_whitespace_normalize_without_inferring_payment(self):
        result = parse_membership_csv(csv_file(
            row(status=" Active ", payment_status=" COMPLETED ", payment_method=" Bank_Transfer "),
            row(status="INACTIVE", payment_status=" ", payment_method=""),
        ))
        self.assertEqual(result["errors"], [])
        first, second = (proposal["values"] for proposal in result["proposed_records"])
        self.assertEqual((first["status"], first["payment_status"], first["payment_method"]),
                         ("active", "completed", "bank_transfer"))
        self.assertEqual((second["status"], second["payment_status"], second["payment_method"]),
                         ("inactive", None, None))

    def test_choice_errors_offer_allowed_values_but_do_not_echo_private_or_unsafe_cells(self):
        result = parse_membership_csv(csv_file(
            row(status="Active", payment_status="Unpaid", payment_method="Coins"),
            row(status="Paid", payment_status="private@example.test",
                email="private-invalid-email"),
            row(status="", first_name="", start_date="2024-02-30", amount_paid="$1.00"),
        ))
        errors = {(item["row"], item["field"]): item["message"] for item in result["errors"]}
        self.assertIn('"Unpaid" is not recognized', errors[2, "payment_status"])
        self.assertIn("pending, completed, failed, canceled, waived", errors[2, "payment_status"])
        self.assertIn("Leave blank if unknown", errors[2, "payment_status"])
        self.assertIn('"Coins" is not recognized', errors[2, "payment_method"])
        self.assertIn('"Paid" is not recognized', errors[3, "status"])
        self.assertNotIn("private@example.test", str(result["errors"]))
        self.assertNotIn("private-invalid-email", str(result["errors"]))
        self.assertIn("valid email", errors[3, "email"])
        self.assertIn("required", errors[4, "status"])
        self.assertIn("required", errors[4, "first_name"])
        self.assertIn("real calendar date", errors[4, "start_date"])
        self.assertIn("two decimal places", errors[4, "amount_paid"])
        self.assertEqual(result["proposed_records"], [])

    def test_end_date_errors_distinguish_calendar_dates_from_date_order(self):
        invalid_calendar = parse_membership_csv(csv_file(row(end_date="2024-02-30")))
        self.assertIn("real calendar date", invalid_calendar["errors"][0]["message"])
        self.assertNotIn("precede", invalid_calendar["errors"][0]["message"])
        out_of_order = parse_membership_csv(csv_file(row(
            start_date="2024-03-01", end_date="2024-02-01",
        )))
        self.assertIn("cannot precede", out_of_order["errors"][0]["message"])

    def test_each_cell_limit_is_enforced_without_echoing_private_content(self):
        for field, limit in MEMBERSHIP_CSV_FIELD_LIMITS.items():
            with self.subTest(field=field):
                result = parse_membership_csv(csv_file(row(**{field: "P" * (limit + 1)})))
                self.assertTrue(any(e["field"] == field for e in result["errors"]))
                self.assertNotIn("P" * (limit + 1), str(result["errors"]))

    def test_rejects_alternate_amount_and_date_formats_without_guessing(self):
        for value in ("$1.00", "1,000.00", "1e2", "+2", "-1", "01.00", "1.001"):
            with self.subTest(amount=value):
                result = parse_membership_csv(csv_file(row(amount_paid=value)))
                self.assertTrue(any(e["field"] == "amount_paid" for e in result["errors"]))
        for value in ("2020-1-01", "2020/01-01", "2020-02-30"):
            with self.subTest(date=value):
                result = parse_membership_csv(csv_file(row(start_date=value)))
                self.assertTrue(any(e["field"] == "start_date" for e in result["errors"]))

    def test_whole_one_and_two_decimal_amounts_normalize_in_both_columns(self):
        # Excel's numeric cells commonly export 50.5 or 0 instead of 50.50
        # or 0.00; those values must remain valid known amounts.
        for price, paid, normalized_price, normalized_paid in (
            ("50.5", "0", "50.50", "0.00"),
            ("12", "1.2", "12.00", "1.20"),
            ("0.00", "99.99", "0.00", "99.99"),
        ):
            with self.subTest(price=price, paid=paid):
                result = parse_membership_csv(csv_file(row(
                    membership_price=price, amount_paid=paid,
                )))
                self.assertEqual(result["errors"], [])
                values = result["proposed_records"][0]["values"]
                self.assertEqual(values["membership_price"], normalized_price)
                self.assertEqual(values["amount_paid"], normalized_paid)

    def test_date_shaped_amounts_give_safe_spreadsheet_repair_guidance(self):
        result = parse_membership_csv(csv_file(row(
            membership_price="1900-01-10", amount_paid="1900-01-00",
        )))
        self.assertEqual(result["proposed_records"], [])
        self.assertEqual({e["field"] for e in result["errors"]},
                         {"membership_price", "amount_paid"})
        for error in result["errors"]:
            self.assertIn("spreadsheet date", error["message"])
            self.assertIn("leave blank if unknown", error["message"])
            self.assertNotIn("1900", error["message"])

    def test_manual_validation_dates_amounts_and_unsupported_choices(self):
        result = parse_membership_csv(csv_file(
            row(amount_paid="-1", start_date="2025-02-30", status="bogus"),
            row(amount_paid="$3.00", payment_method="coins", email="not-an-email"),
            row(start_date="2020-01-02", end_date="2020-01-01"),
            row(first_name="", membership_price="1,000.00", payment_status="bogus"),
        ))
        for row_number, field in ((2, "amount_paid"), (2, "start_date"), (2, "status"),
                                  (3, "amount_paid"), (3, "payment_method"), (3, "email"),
                                  (4, "end_date"), (5, "first_name"),
                                  (5, "membership_price"), (5, "payment_status")):
            with self.subTest(row=row_number, field=field):
                self.assertTrue(any(e["row"] == row_number and e["field"] == field
                                    for e in result["errors"]))
        self.assertEqual(result["proposed_records"], [])
        self.assertNotIn("not-an-email", str(result["errors"]))
        self.assertFalse(Membership.objects.exists())


class MembershipCsvPreviewEndpointTests(TestCase):
    """Keep authentication, safe responses and no-write behavior at the API boundary."""

    url = "/api/donations/memberships/import/preview/"

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="csv-admin@example.test", permissions_data={"Finances": True},
        )
        self.client = APIClient()

    def post_csv(self, raw=None):
        """Submit one synthetic CSV via the real multipart request parser."""
        return self.client.post(self.url, {"file": SimpleUploadedFile(
            "membership.csv", csv_file(row()) if raw is None else raw, content_type="text/csv",
        )}, format="multipart")

    def test_permission_blocks_parsing_and_private_data(self):
        for permissions, active, expected in ((None, True, 401), ({}, True, 403),
                                              ({"Finances": False}, True, 403),
                                              ({"Finances": True}, False, 403)):
            with self.subTest(expected=expected, active=active):
                self.user.permissions_data = permissions or {}
                self.user.is_active = active
                self.client.force_authenticate(user=self.user if permissions is not None else None)
                with patch("donations.membership_import_views.parse_membership_csv") as parse:
                    response = self.post_csv(csv_file(row(email="private@example.test")))
                self.assertEqual(response.status_code, expected)
                self.assertNotIn("private@example.test", str(response.data))
                parse.assert_not_called()

    def test_preview_returns_normalized_records_without_writing_or_external_actions(self):
        self.client.force_authenticate(user=self.user)
        with patch("donations.manual_memberships._persist_manual_membership") as save, \
             patch("donations.receipts.send_membership_receipt") as receipt:
            response = self.post_csv(csv_file(row(amount_paid="0.00", email="TEST@EXAMPLE.TEST")))
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response["Cache-Control"], "no-store, private")
        self.assertEqual(response.data["record_type"], "membership")
        self.assertEqual(response.data["row_count"], 1)
        self.assertEqual(response.data["proposed_records"][0]["values"]["amount_paid"], "0.00")
        self.assertEqual(response.data["proposed_records"][0]["values"]["email"],
                         "test@example.test")
        self.assertFalse(Membership.objects.exists())
        save.assert_not_called()
        receipt.assert_not_called()

    def test_missing_or_oversized_upload_is_rejected(self):
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.post(self.url, {}, format="multipart").status_code, 400)
        self.assertEqual(self.post_csv(b"x" * (MAX_MEMBERSHIP_CSV_BYTES + 1)).status_code, 400)
        self.assertFalse(Membership.objects.exists())

    def test_endpoint_reports_field_errors_without_reflecting_private_values(self):
        self.client.force_authenticate(user=self.user)
        response = self.post_csv(csv_file(row(email="private-invalid-email", status="unsupported")))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["row_count"], 1)
        self.assertEqual(response.data["proposed_records"], [])
        self.assertEqual(
            {(error["row"], error["field"]) for error in response.data["errors"]},
            {(2, "email"), (2, "status")},
        )
        self.assertNotIn("private-invalid-email", str(response.data))
        self.assertFalse(Membership.objects.exists())
