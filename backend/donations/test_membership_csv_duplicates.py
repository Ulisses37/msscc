from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from donations.membership_csv_duplicates import membership_duplicate_warnings
from donations.models import Membership
from donations.test_membership_csv_preview import csv_file, row


class MembershipCsvDuplicateRuleTests(TestCase):
    """Warnings are evidence for review, never a decision to merge or discard."""

    def proposal(self, row_number, **overrides):
        """Use interpreted values rather than comparing raw spreadsheet text."""
        values = {
            "first_name": "Maya", "last_name": "Member", "membership_type": "Life",
            "status": "unknown", "email": None, "phone": None, "address": None,
            "membership_price": None, "amount_paid": None, "start_date": None,
            "end_date": None, "renewal_date": None, "payment_status": None,
            "payment_method": None, "reference_id": "", "notes": "",
        }
        values.update(overrides)
        return {"row": row_number, "values": values}

    def test_repeated_validated_rows_flag_later_rows_only(self):
        # Three identical rows must point to the original, not to each other.
        first = self.proposal(2)
        warnings = membership_duplicate_warnings([first, self.proposal(3), self.proposal(4)])
        self.assertEqual([(w["row"], w["reason"]) for w in warnings], [
            (3, "repeated_row"), (4, "repeated_row"),
        ])
        self.assertIn("row 2", warnings[0]["message"])

    def test_unknown_and_zero_are_not_identical(self):
        # A recorded waiver/zero is not an omitted historical amount.
        self.assertEqual(membership_duplicate_warnings([
            self.proposal(2), self.proposal(3, amount_paid="0.00"),
        ]), [])

    def test_existing_match_requires_reference_or_name_type_and_known_date(self):
        # The same email can belong to successive memberships or a household;
        # name/type/date and a supplied reference are independent evidence.
        Membership.objects.create(
            first_name_encrypted="Maya", last_name_encrypted="Member",
            email_encrypted="same@example.test", membership_type="Life", status="unknown",
            start_date="2000-01-02", reference_id="LEDGER-1", notes="",
        )
        warnings = membership_duplicate_warnings([
            self.proposal(2, first_name=" maya ", last_name="MEMBER", membership_type=" life ",
                          start_date="2000-01-02", reference_id="LEDGER-1"),
            self.proposal(3, first_name="Someone", email="same@example.test",
                          start_date="2000-01-02"),
            self.proposal(4, email="same@example.test"),
        ])
        self.assertEqual({(w["row"], w["reason"]) for w in warnings}, {
            (2, "existing_reference"), (2, "existing_identity_date"),
        })
        self.assertNotIn("same@example.test", str(warnings))


class MembershipCsvDuplicateEndpointTests(TestCase):
    """Existing-record checks must only run after financial authorization."""

    url = "/api/donations/memberships/import/preview/"

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="csv-reviewer@example.test", permissions_data={"Finances": True},
        )
        self.client = APIClient()

    def upload(self, *rows):
        """Exercise the real multipart preview boundary."""
        return self.client.post(self.url, {"file": SimpleUploadedFile(
            "membership.csv", csv_file(*rows), content_type="text/csv",
        )}, format="multipart")

    def test_preview_warns_without_creating_and_denies_unprivileged_users(self):
        existing = Membership.objects.create(
            first_name_encrypted="Maya", last_name_encrypted="Member", membership_type="Life",
            start_date="2000-01-02", status="unknown", reference_id="LEDGER-1", notes="",
        )
        csv_rows = (row(first_name="Maya", last_name="Member", membership_type="Life",
                        start_date="2000-01-02", reference_id="LEDGER-1"),
                    row(first_name="Maya", last_name="Member", membership_type="Life",
                        start_date="2000-01-02", reference_id="LEDGER-1"))
        for user, expected in ((None, 401), (self.user, 403)):
            # Authorization must precede any query that decrypts existing names.
            self.user.permissions_data = {}
            self.client.force_authenticate(user=user)
            response = self.upload(*csv_rows)
            self.assertEqual(response.status_code, expected)
            self.assertNotIn("LEDGER-1", str(response.data))
        self.user.permissions_data = {"Finances": True}
        self.client.force_authenticate(user=self.user)
        response = self.upload(*csv_rows)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["row_count"], 2)
        self.assertEqual(len(response.data["proposed_records"]), 2)
        self.assertEqual({w["reason"] for w in response.data["warnings"]}, {
            "repeated_row", "existing_reference", "existing_identity_date",
        })
        self.assertEqual(Membership.objects.count(), 1)
        self.assertEqual(Membership.objects.get(pk=existing.pk).reference_id, "LEDGER-1")

    def test_email_alone_never_warns_and_invalid_rows_are_not_compared(self):
        Membership.objects.create(
            first_name_encrypted="Other", last_name_encrypted="Member",
            email_encrypted="same@example.test", membership_type="Life", status="unknown",
            reference_id="", notes="",
        )
        self.client.force_authenticate(user=self.user)
        response = self.upload(row(email="same@example.test"), row(email="bad-email"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["warnings"], [])
        self.assertEqual(len(response.data["proposed_records"]), 1)
        self.assertEqual(response.data["errors"][0]["field"], "email")
