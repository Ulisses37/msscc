"""Donation CSV authorization, all-or-none persistence and safe retry tests."""

from contextlib import ExitStack
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import signing
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import DatabaseError, connection
from django.test import TestCase
from rest_framework.test import APIClient

from config.encryption import EncryptedTextError
from donations.donation_csv_confirmation import TOKEN_SALT, batch_fingerprint, confirm_review
from donations.manual_donations import create_manual_donation
from donations.models import Donation, DonationImportBatch
from donations.test_donation_csv_preview import csv_file, row


class DonationCsvConfirmationTests(TestCase):
    """Exercise real multipart endpoints while keeping the test DB isolated."""

    preview_url = "/api/donations/import/preview/"
    confirm_url = "/api/donations/import/confirm/"

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="donation-confirm-admin@example.test", permissions_data={"Finances": True},
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.raw = csv_file(row(
            donor_first_name="Fictional", donor_last_name="Donor",
            donor_email="FICTIONAL@EXAMPLE.TEST", payment_method="check",
        ), row(amount="12.50", is_anonymous="TRUE", donor_email="anon@example.test"))

    def send(self, url, raw=None, **fields):
        return self.client.post(url, {
            "file": SimpleUploadedFile("fictional.csv", self.raw if raw is None else raw),
            **fields,
        }, format="multipart")

    def review(self, raw=None):
        response = self.send(self.preview_url, raw)
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def confirm(self, token, raw=None, acknowledged=False):
        return self.send(self.confirm_url, raw, review_token=token,
                         acknowledge_warnings=str(acknowledged).lower())

    def test_choice_and_decimal_spelling_variants_resolve_to_the_same_batch(self):
        """Case/spacing and one-decimal spelling must not evade idempotency."""
        original = csv_file(row(amount="2.5", payment_method="Cash", is_anonymous="FALSE"))
        canonical = csv_file(row(amount="2.50", payment_method="cash", is_anonymous="false"))
        first = self.review(original)
        self.assertEqual(first["errors"], [])
        saved = self.confirm(first["review_token"], original)
        self.assertEqual(saved.status_code, 201, saved.data)
        second = self.review(canonical)
        self.assertEqual(second["errors"], [])
        retry = self.confirm(second["review_token"], canonical)
        self.assertEqual(retry.status_code, 200, retry.data)
        self.assertTrue(retry.data["already_imported"])
        self.assertEqual(retry.data["batch_id"], saved.data["batch_id"])
        self.assertEqual(Donation.objects.count(), 1)

    def test_payment_alias_blank_anonymity_and_discarded_names_cannot_change_batch(self):
        raw = csv_file(row(payment_method="credit_card", is_anonymous="TRUE",
                           donor_first_name="Not saved", address="Private street"))
        first = self.review(raw)
        self.assertEqual(first["errors"], [])
        self.assertNotIn("Not saved", str(first))
        saved = self.confirm(first["review_token"], raw)
        self.assertEqual(saved.status_code, 201, saved.data)
        donation = Donation.objects.get()
        self.assertEqual(donation.payment_method, "card")
        self.assertIsNone(donation.donor_first_name_encrypted)
        self.assertIsNone(donation.donor_address_encrypted)
        canonical = csv_file(row(payment_method="CARD", is_anonymous="true"))
        second = self.review(canonical)
        retry = self.confirm(second["review_token"], canonical)
        self.assertEqual(retry.status_code, 200, retry.data)
        self.assertEqual(retry.data["batch_id"], saved.data["batch_id"])
        self.assertEqual(Donation.objects.count(), 1)

    def test_atomic_received_save_encryption_anonymity_and_idempotent_retry(self):
        preview = self.review()
        self.assertTrue(preview["review_token"])
        self.assertEqual(preview["warnings"], [])
        self.assertEqual(Donation.objects.count(), 0)
        targets = (
            "payments.services.stripe_service.create_payment_session",
            "donations.receipts.send_donation_receipt", "donations.receipts.send_email",
            "emails.services.send_email", "emails.subscribers.subscribe_contact",
        )
        with ExitStack() as stack:
            mocks = [stack.enter_context(patch(target)) for target in targets]
            with self.captureOnCommitCallbacks(execute=True) as callbacks:
                saved = self.confirm(preview["review_token"])
                retry = self.confirm(preview["review_token"])
            self.assertEqual(callbacks, [])
            for mock in mocks:
                mock.assert_not_called()
        self.assertEqual(saved.status_code, 201, saved.data)
        self.assertEqual(saved["Cache-Control"], "no-store, private")
        self.assertEqual(saved.data["record_type"], "donation")
        self.assertEqual(saved.data["created_count"], 2)
        self.assertFalse(saved.data["already_imported"])
        self.assertEqual(retry.status_code, 200, retry.data)
        self.assertEqual(retry.data["batch_id"], saved.data["batch_id"])
        self.assertTrue(retry.data["already_imported"])
        self.assertEqual(DonationImportBatch.objects.count(), 1)
        self.assertEqual(Donation.objects.count(), 2)
        first, anonymous = [Donation.objects.get(pk=pk) for pk in saved.data["donation_ids"]]
        self.assertEqual(first.donor_first_name_encrypted, "Fictional")
        self.assertEqual(first.donor_email_encrypted, "fictional@example.test")
        # Model access decrypts PII; the stored database value must not reveal
        # the donor's name or email to an incidental database reader.
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT donor_first_name_encrypted, donor_email_encrypted "
                "FROM donations_donation WHERE donation_id = %s", [first.pk],
            )
            stored_name, stored_email = cursor.fetchone()
        self.assertNotIn("Fictional", stored_name)
        self.assertNotIn("fictional@example.test", stored_email)
        self.assertIsNone(anonymous.donor_first_name_encrypted)
        self.assertIsNone(anonymous.donor_address_encrypted)
        self.assertEqual(anonymous.donor_email_encrypted, "anon@example.test")
        for donation in (first, anonymous):
            self.assertEqual(donation.record_source, "csv_import")
            self.assertEqual(str(donation.import_batch_id), saved.data["batch_id"])
            self.assertEqual(donation.payment_status, "completed")
            self.assertEqual(donation.currency, "usd")
            self.assertTrue(donation.reference_id.startswith("DON-CSV-"))
            self.assertEqual(donation.total_amount, donation.amount)
            self.assertEqual(donation.processing_cost_contribution, Decimal("0.00"))
            self.assertFalse(donation.contribute_to_processing_costs)
            self.assertIsNone(donation.receipt_sent_at)
            self.assertIsNone(donation.completed_at)
        self.assertEqual(first.payment_method, "check")
        self.assertIsNone(anonymous.payment_method)

    def test_identical_normalized_facts_in_other_excel_spelling_reuse_batch(self):
        first = self.review()
        saved = self.confirm(first["review_token"])
        alternative = csv_file(row(
            amount="35", donation_date="01/02/1990", is_anonymous=" False ",
            donor_first_name="Fictional", donor_last_name="Donor",
            donor_email="fictional@example.test", payment_method="check",
        ), row(amount="12.5", donation_date="01-02-1990", is_anonymous="true",
               donor_email="anon@example.test"))
        second = self.review(alternative)
        self.assertTrue(second["warnings"])
        reused = self.confirm(second["review_token"], alternative)
        self.assertEqual(reused.status_code, 200, reused.data)
        self.assertEqual(reused.data["batch_id"], saved.data["batch_id"])
        self.assertEqual(Donation.objects.count(), 2)

    def test_denied_tampered_and_invalid_review_never_creates(self):
        invalid = self.review(csv_file(row(amount="0.00")))
        self.assertIsNone(invalid["review_token"])
        token = self.review()["review_token"]
        other = get_user_model().objects.create_user(
            email="other-donation-admin@example.test", permissions_data={"Finances": True},
        )
        for user, expected in ((other, 400), (None, 401)):
            self.client.force_authenticate(user=user)
            self.assertEqual(self.confirm(token).status_code, expected)
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.confirm(token + "tampered").status_code, 400)
        self.assertEqual(self.confirm(token, csv_file(row(amount="90.00"))).status_code, 400)
        self.assertEqual(self.confirm("").status_code, 400)
        self.user.permissions_data = {}
        self.assertEqual(self.confirm(token).status_code, 403)
        self.user.permissions_data = {"Finances": True}
        self.user.is_active = False
        self.assertEqual(self.confirm(token).status_code, 403)
        self.assertFalse(DonationImportBatch.objects.exists())
        self.assertFalse(Donation.objects.exists())

    def test_expired_token_can_recover_only_a_committed_batch(self):
        valid = self.review()
        with patch("donations.donation_csv_confirmation.signing.time.time", return_value=0):
            old = signing.dumps(signing.loads(valid["review_token"], salt=TOKEN_SALT),
                                salt=TOKEN_SALT)
        self.assertEqual(self.confirm(old).status_code, 400)
        self.assertFalse(Donation.objects.exists())
        saved = self.confirm(valid["review_token"])
        recovered = self.confirm(old)
        self.assertEqual(recovered.status_code, 200, recovered.data)
        self.assertEqual(recovered.data["batch_id"], saved.data["batch_id"])
        self.assertEqual(Donation.objects.count(), 2)

    def test_changed_warnings_and_unacknowledged_rows_cannot_save(self):
        raw = csv_file(row(external_reference="TEST-LEDGER"))
        preview = self.review(raw)
        create_manual_donation({
            "amount": "35.00", "donation_date": "1990-01-02",
            "external_reference": "TEST-LEDGER",
        })
        self.assertEqual(self.confirm(preview["review_token"], raw).status_code, 409)
        self.assertEqual(DonationImportBatch.objects.count(), 0)
        repeated = csv_file(row(), row())
        warning_preview = self.review(repeated)
        self.assertTrue(warning_preview["warnings"])
        self.assertEqual(self.confirm(warning_preview["review_token"], repeated).status_code, 409)
        self.assertEqual(DonationImportBatch.objects.count(), 0)
        saved = self.confirm(warning_preview["review_token"], repeated, acknowledged=True)
        self.assertEqual(saved.status_code, 201, saved.data)
        self.assertEqual(saved.data["created_count"], 2)

    def test_losing_reservation_returns_winning_receipt_before_warning_recheck(self):
        preview = self.review()
        winner = self.confirm(preview["review_token"])
        batch = DonationImportBatch.objects.get(pk=winner.data["batch_id"])
        # Simulate get_or_create waiting for a concurrent winner's unique key.
        with patch("donations.donation_csv_confirmation.DonationImportBatch.objects.get_or_create",
                   return_value=(batch, False)), patch(
                       "donations.donation_csv_confirmation.donation_duplicate_warnings",
                   ) as warnings:
            result, error = confirm_review(preview["proposed_records"],
                                           batch_fingerprint(preview["proposed_records"]),
                                           [], False, self.user)
        self.assertIsNone(error)
        self.assertEqual(result["batch_id"], winner.data["batch_id"])
        self.assertTrue(result["already_imported"])
        warnings.assert_not_called()

    def test_failure_on_later_row_rolls_back_batch_and_first_donation(self):
        preview = self.review()
        calls = 0

        def fail_second(*args, **kwargs):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise DatabaseError("synthetic private failure")
            return create_manual_donation(*args, **kwargs)

        with patch("donations.donation_csv_confirmation.create_manual_donation",
                   side_effect=fail_second), self.assertRaises(DatabaseError):
            confirm_review(preview["proposed_records"],
                           batch_fingerprint(preview["proposed_records"]), [], False, self.user)
        self.assertFalse(Donation.objects.exists())
        self.assertFalse(DonationImportBatch.objects.exists())

    def test_database_failure_returns_private_response_without_partial_save(self):
        preview = self.review()
        calls = 0

        def fail_second(*args, **kwargs):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise DatabaseError("synthetic private failure")
            return create_manual_donation(*args, **kwargs)

        with patch("donations.donation_csv_confirmation.create_manual_donation",
                   side_effect=fail_second):
            response = self.confirm(preview["review_token"])
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response["Cache-Control"], "no-store, private")
        self.assertNotIn("synthetic private failure", str(response.data))
        self.assertFalse(Donation.objects.exists())
        self.assertFalse(DonationImportBatch.objects.exists())

    def test_encryption_failure_returns_private_response_and_rolls_back_batch(self):
        preview = self.review()
        with patch("config.fields.encrypt_text", side_effect=EncryptedTextError("private-key")):
            response = self.confirm(preview["review_token"])
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private-key", str(response.data))
        self.assertFalse(Donation.objects.exists())
        self.assertFalse(DonationImportBatch.objects.exists())
