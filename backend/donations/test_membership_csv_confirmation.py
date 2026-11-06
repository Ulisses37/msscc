from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import signing
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import DatabaseError
from django.test import TestCase
from rest_framework.test import APIClient

from donations.membership_csv_confirmation import TOKEN_SALT, batch_fingerprint, confirm_review
from donations.models import Membership, MembershipImportBatch
from donations.test_membership_csv_preview import csv_file, row


class MembershipCsvConfirmationTests(TestCase):
    """Exercise the real multipart preview/confirmation authorization boundary."""

    preview_url = "/api/donations/memberships/import/preview/"
    confirm_url = "/api/donations/memberships/import/confirm/"

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="csv-confirm@example.test", permissions_data={"Finances": True},
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.raw = csv_file(row(
            first_name="Maya", email="MAYA@EXAMPLE.TEST", amount_paid="0.00",
        ), row(first_name="Other", amount_paid=""))

    def send(self, url, raw=None, **fields):
        return self.client.post(url, {
            "file": SimpleUploadedFile("members.csv", self.raw if raw is None else raw),
            **fields,
        }, format="multipart")

    def review(self, raw=None):
        response = self.send(self.preview_url, raw)
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def confirm(self, token, raw=None, acknowledged=False):
        return self.send(self.confirm_url, raw, review_token=token,
                         acknowledge_warnings=str(acknowledged).lower())

    def test_save_is_atomic_encrypted_and_retries_return_one_batch(self):
        preview = self.review()
        self.assertTrue(preview["review_token"])
        self.assertEqual(preview["warnings"], [])
        with patch("donations.receipts.send_membership_receipt") as receipt:
            saved = self.confirm(preview["review_token"])
        self.assertEqual(saved.status_code, 201, saved.data)
        self.assertEqual(saved["Cache-Control"], "no-store, private")
        self.assertEqual(saved.data["created_count"], 2)
        self.assertFalse(saved.data["already_imported"])
        self.assertEqual(MembershipImportBatch.objects.count(), 1)
        self.assertEqual(Membership.objects.filter(record_source="csv_import").count(), 2)
        first = Membership.objects.get(pk=saved.data["membership_ids"][0])
        self.assertEqual(first.email_encrypted, "maya@example.test")
        self.assertEqual(first.amount_paid, 0)
        self.assertEqual(str(first.import_batch_id), saved.data["batch_id"])
        self.assertTrue(first.reference_id.startswith("MEM-CSV-"))
        self.assertIsNone(first.stripe_payment_intent_id)
        self.assertIsNone(first.receipt_sent_at)
        receipt.assert_not_called()

        # A dropped response must not cause a second write, even after the
        # first import makes its own rows look like potential duplicates.
        retry = self.confirm(preview["review_token"])
        self.assertEqual(retry.status_code, 200, retry.data)
        self.assertTrue(retry.data["already_imported"])
        self.assertEqual(retry.data["batch_id"], saved.data["batch_id"])
        self.assertEqual(Membership.objects.count(), 2)

    def test_normalized_identical_content_returns_prior_batch(self):
        first = self.review()
        saved = self.confirm(first["review_token"])
        # Different casing normalizes to the same interpreted membership facts.
        changed = csv_file(row(first_name="Maya", email="maya@example.test",
                               amount_paid="0"), row(first_name="Other", amount_paid=""))
        second = self.review(changed)
        self.assertNotEqual(first["review_token"], second["review_token"])
        result = self.confirm(second["review_token"], changed)
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data["batch_id"], saved.data["batch_id"])
        self.assertEqual(Membership.objects.count(), 2)

    def test_rejects_other_admin_inactive_unauthorized_tampered_and_changed_file(self):
        token = self.review()["review_token"]
        other = get_user_model().objects.create_user(
            email="other-csv@example.test", permissions_data={"Finances": True},
        )
        for user, expected in ((other, 400), (None, 401)):
            self.client.force_authenticate(user=user)
            self.assertEqual(self.confirm(token).status_code, expected)
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.confirm(token + "tampered").status_code, 400)
        self.assertEqual(self.confirm(token, csv_file(row(first_name="Changed"))).status_code, 400)
        self.user.permissions_data = {}
        self.assertEqual(self.confirm(token).status_code, 403)
        self.user.permissions_data = {"Finances": True}
        self.user.is_active = False
        self.assertEqual(self.confirm(token).status_code, 403)
        self.assertFalse(MembershipImportBatch.objects.exists())

    def test_invalid_and_expired_reviews_cannot_create(self):
        invalid = self.review(csv_file(row(status="bad")))
        self.assertIsNone(invalid["review_token"])
        self.assertEqual(self.confirm("").status_code, 400)
        valid = self.review()
        with patch("donations.membership_csv_confirmation.signing.time.time", return_value=0):
            old_token = signing.dumps(signing.loads(valid["review_token"], salt=TOKEN_SALT),
                                      salt=TOKEN_SALT)
        self.assertEqual(self.confirm(old_token).status_code, 400)
        self.assertFalse(Membership.objects.exists())

    def test_expired_token_may_only_recover_an_already_committed_batch(self):
        valid = self.review()
        saved = self.confirm(valid["review_token"])
        with patch("donations.membership_csv_confirmation.signing.time.time", return_value=0):
            old_token = signing.dumps(signing.loads(valid["review_token"], salt=TOKEN_SALT),
                                      salt=TOKEN_SALT)
        recovered = self.confirm(old_token)
        self.assertEqual(recovered.status_code, 200, recovered.data)
        self.assertEqual(recovered.data["batch_id"], saved.data["batch_id"])
        self.assertEqual(Membership.objects.count(), 2)

    def test_losing_reservation_returns_winning_batch_without_rechecking_warnings(self):
        preview = self.review()
        winner = self.confirm(preview["review_token"])
        batch = MembershipImportBatch.objects.get(pk=winner.data["batch_id"])
        # Simulate get_or_create having waited on a concurrent transaction's
        # unique insert. Its rows now look like new duplicate warnings; the
        # losing request must return the winner's receipt instead of saving.
        reserve = (
            "donations.membership_csv_confirmation."
            "MembershipImportBatch.objects.get_or_create"
        )
        with patch(reserve, return_value=(batch, False)), patch(
                       "donations.membership_csv_confirmation.membership_duplicate_warnings",
                   ) as warnings:
            result, error = confirm_review(preview["proposed_records"],
                                           batch_fingerprint(preview["proposed_records"]), [],
                                           False, self.user)
        self.assertIsNone(error)
        self.assertEqual(result["batch_id"], winner.data["batch_id"])
        self.assertTrue(result["already_imported"])
        warnings.assert_not_called()

    def test_new_warnings_or_unacknowledged_warnings_block_save(self):
        self.review()
        Membership.objects.create(
            first_name_encrypted="Maya", last_name_encrypted="Member",
            membership_type="Life", status="unknown", start_date="1990-01-01",
            reference_id="", notes="",
        )
        # Explicit reference evidence is introduced after preview.
        raw = csv_file(row(reference_id="LEDGER-1"))
        other_preview = self.review(raw)
        Membership.objects.create(
            first_name_encrypted="Other", last_name_encrypted="Member",
            membership_type="Life", status="unknown", reference_id="LEDGER-1", notes="",
        )
        self.assertEqual(self.confirm(other_preview["review_token"], raw).status_code, 409)
        self.assertEqual(MembershipImportBatch.objects.count(), 0)
        repeated = csv_file(row(), row())
        warning_preview = self.review(repeated)
        self.assertTrue(warning_preview["warnings"])
        self.assertEqual(self.confirm(warning_preview["review_token"], repeated).status_code, 409)
        saved = self.confirm(warning_preview["review_token"], repeated, acknowledged=True)
        self.assertEqual(saved.status_code, 201, saved.data)
        self.assertEqual(saved.data["created_count"], 2)

    def test_database_error_rolls_back_batch_and_earlier_rows(self):
        from donations.manual_memberships import create_manual_membership

        calls = 0

        def fail_second(*args, **kwargs):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise DatabaseError("synthetic failure")
            return create_manual_membership(*args, **kwargs)

        # Test at the transaction boundary without leaking exception text via
        # an HTTP 500; even the first successfully saved row must be undone.
        preview = self.review()
        with patch("donations.membership_csv_confirmation.create_manual_membership",
                   side_effect=fail_second):
            with self.assertRaises(DatabaseError):
                confirm_review(preview["proposed_records"],
                               batch_fingerprint(preview["proposed_records"]), [], False, self.user)
        self.assertFalse(Membership.objects.exists())
        self.assertFalse(MembershipImportBatch.objects.exists())
