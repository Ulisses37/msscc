from datetime import date
from decimal import Decimal
from io import StringIO
from unittest.mock import patch

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import DatabaseError, connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from config.encryption import ENCRYPTED_TEXT_ENVELOPE_PREFIX, EncryptedTextError, decrypt_text
from donations.management.commands.rotate_financial_pii import ROTATION_FIELDS

from .models import Donation, Membership


class PIIRotationTests(TestCase):
    """Exercise controlled rotation exclusively against isolated test storage."""

    def setUp(self):
        self.primary_key = Fernet.generate_key().decode("ascii")
        self.previous_key = Fernet.generate_key().decode("ascii")
        self.output = StringIO()
        self.errors = StringIO()

    def create_donation(self, **overrides):
        """Create a representative donation with old-key PII."""
        values = {
            "donor_first_name_encrypted": "松山 O'Connor ☕\n",
            "donor_last_name_encrypted": "Example",
            "donor_email_encrypted": "private@example.test",
            "amount": Decimal("123.45"),
            "currency": "jpy",
            "completed_at": timezone.now(),
            "donation_date": date(2026, 10, 21),
            "is_anonymous": True,
            "message": "Unchanged message",
            "payment_status": "completed",
            "reference_id": "rotation-donation",
        }
        with override_settings(FIELD_ENCRYPTION_KEYS=(self.previous_key,)):
            return Donation.objects.create(**(values | overrides))

    def create_membership(self, **overrides):
        """Create a representative membership with old-key PII."""
        values = {
            "first_name_encrypted": "松山",
            "last_name_encrypted": "O'Connor",
            "email_encrypted": "member@example.test",
            "phone_encrypted": "+1 (555) 123-4567",
            "membership_type": "individual",
            "amount_paid": Decimal("25.00"),
            "completed_at": timezone.now(),
            "start_date": date(2026, 10, 21),
            "end_date": date(2027, 10, 21),
            "renewal_date": date(2027, 10, 21),
            "payment_status": "completed",
            "reference_id": "rotation-membership",
            "checkout_reference": "rotation-checkout",
            "stripe_payment_intent_id": "pi_rotation_test",
            "membership_option_id": "individual",
            "expected_amount": Decimal("25.00"),
            "currency": "usd",
            "status": "active",
            "notes": "Unchanged notes",
        }
        with override_settings(FIELD_ENCRYPTION_KEYS=(self.previous_key,)):
            return Membership.objects.create(**(values | overrides))

    def rotate(self, **options):
        """Run the command with a new primary and the retained previous key."""
        with override_settings(FIELD_ENCRYPTION_KEYS=(self.primary_key, self.previous_key)):
            call_command(
                "rotate_financial_pii", stdout=self.output, stderr=self.errors,
                **({"confirm": True} | options),
            )

    def raw_values(self, record, fields):
        """Inspect ciphertext without triggering encrypted-field converters."""
        quote = connection.ops.quote_name
        columns = ", ".join(quote(record._meta.get_field(field).column) for field in fields)
        with connection.cursor() as cursor:
            cursor.execute(
                f"SELECT {columns} FROM {quote(record._meta.db_table)} "
                f"WHERE {quote(record._meta.pk.column)} = %s", [record.pk],
            )
            return cursor.fetchone()

    def corrupt(self, record, field, value):
        """Bypass encryption only in the isolated test database."""
        quote = connection.ops.quote_name
        with connection.cursor() as cursor:
            cursor.execute(
                f"UPDATE {quote(record._meta.db_table)} SET {quote(field)} = %s "
                f"WHERE {quote(record._meta.pk.column)} = %s", [value, record.pk],
            )

    def test_rotates_all_fields_and_preserves_every_other_record_value(self):
        records = (self.create_donation(), self.create_membership())
        snapshots = [
            {
                field.attname: getattr(record, field.attname)
                for field in record._meta.concrete_fields
            }
            for record in records
        ]
        previous_ciphertexts = []
        for record, (_, fields) in zip(records, ROTATION_FIELDS, strict=True):
            with override_settings(FIELD_ENCRYPTION_KEYS=(self.primary_key, self.previous_key)):
                record.refresh_from_db()
            previous_ciphertexts.append(self.raw_values(record, fields))

        self.rotate(batch_size=1)

        for record, snapshot, before, (_, fields) in zip(
            records, snapshots, previous_ciphertexts, ROTATION_FIELDS, strict=True,
        ):
            with override_settings(FIELD_ENCRYPTION_KEYS=(self.primary_key,)):
                record.refresh_from_db()
            for field, value in snapshot.items():
                self.assertEqual(getattr(record, field), value)
            after = self.raw_values(record, fields)
            self.assertNotEqual(before, after)
            for field, ciphertext in zip(fields, after, strict=True):
                token = ciphertext.removeprefix(ENCRYPTED_TEXT_ENVELOPE_PREFIX).encode("ascii")
                self.assertEqual(
                    Fernet(self.primary_key.encode("ascii")).decrypt(token).decode("utf-8"),
                    snapshot[field],
                )
                with self.assertRaises(InvalidToken):
                    Fernet(self.previous_key.encode("ascii")).decrypt(token)
        self.assertIn(
            "Rotation complete. Committed records: 2; batches: 2.", self.output.getvalue(),
        )

    def test_blank_and_null_values_are_preserved_for_every_field(self):
        for value in ("", None):
            donation_fields = ROTATION_FIELDS[0][1]
            membership_fields = ROTATION_FIELDS[1][1]
            donation = self.create_donation(**dict.fromkeys(donation_fields, value))
            membership = self.create_membership(
                **dict.fromkeys(membership_fields, value),
                checkout_reference=None, stripe_payment_intent_id=None,
            )
            self.rotate()
            with override_settings(FIELD_ENCRYPTION_KEYS=(self.primary_key,)):
                for record, fields in (
                    (donation, donation_fields), (membership, membership_fields),
                ):
                    record.refresh_from_db()
                    for field in fields:
                        self.assertEqual(getattr(record, field), value)

    def test_bounded_batches_lock_rows_and_never_call_model_save(self):
        for _ in range(5):
            self.create_donation()
        queryset_class = type(Donation.objects.all())
        original_lock = queryset_class.select_for_update
        locked_batch_sizes = []
        original_update = queryset_class.update

        def locked(queryset, *args, **kwargs):
            result = original_lock(queryset, *args, **kwargs)
            self.assertTrue(connection.in_atomic_block)
            return result

        def updated(queryset, **kwargs):
            locked_batch_sizes.append(set(kwargs))
            return original_update(queryset, **kwargs)

        with (
            CaptureQueriesContext(connection) as queries,
            patch.object(queryset_class, "select_for_update", autospec=True, side_effect=locked)
            as lock,
            patch.object(queryset_class, "update", autospec=True, side_effect=updated),
            patch.object(Donation, "save") as save,
        ):
            self.rotate(batch_size=2)
        self.assertEqual(lock.call_count, 3)
        batch_selects = [query["sql"] for query in queries if "LIMIT 2" in query["sql"]]
        self.assertEqual(len(batch_selects), 3)
        self.assertEqual(locked_batch_sizes, [set(ROTATION_FIELDS[0][1])] * 5)
        save.assert_not_called()
        self.assertIn("Committed records: 5; batches: 3.", self.output.getvalue())

    def test_requires_confirmation_and_valid_batch_size_before_database_access(self):
        for options in ({"confirm": False}, {"batch_size": 0}, {"batch_size": -1},
                        {"batch_size": 1001}):
            with self.subTest(options=options), self.assertNumQueries(0):
                with self.assertRaises(CommandError):
                    self.rotate(**options)

    def test_invalid_or_missing_configuration_fails_even_with_empty_tables(self):
        for keyring in (None, (), ("invalid-private-key",), (self.primary_key, self.primary_key)):
            with self.subTest(keyring=keyring), override_settings(FIELD_ENCRYPTION_KEYS=keyring):
                with self.assertNumQueries(0), self.assertRaises(CommandError) as captured:
                    call_command("rotate_financial_pii", confirm=True, stdout=self.output)
                self.assertNotIn("invalid-private-key", str(captured.exception))
        with override_settings():
            del settings.FIELD_ENCRYPTION_KEYS
            with self.assertRaises(CommandError):
                call_command("rotate_financial_pii", confirm=True, stdout=self.output)

    def test_tampered_ciphertext_rolls_back_failing_batch_without_disclosure(self):
        first = self.create_donation()
        second = self.create_donation()
        fields = ROTATION_FIELDS[0][1]
        before = self.raw_values(first, fields)
        damaged = "msscc:enc:v1:private-damaged-token"
        self.corrupt(second, fields[-1], damaged)
        with self.assertNoLogs(), self.assertRaises(CommandError) as captured:
            self.rotate(batch_size=2)
        self.assertEqual(self.raw_values(first, fields), before)
        exposed = str(captured.exception) + self.output.getvalue() + self.errors.getvalue()
        for sensitive in (damaged, self.primary_key, self.previous_key, *before,
                          "private@example.test", "松山"):
            self.assertNotIn(sensitive, exposed)
        self.assertIn("Committed records: 0; batches: 0.", str(captured.exception))

    def test_database_failure_after_first_update_rolls_back_whole_batch(self):
        record = self.create_donation()
        self.create_donation()
        fields = ROTATION_FIELDS[0][1]
        before = self.raw_values(record, fields)
        queryset_class = type(Donation.objects.all())
        original_update = queryset_class.update
        calls = 0

        def failing_update(queryset, **kwargs):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise DatabaseError("private database detail")
            return original_update(queryset, **kwargs)

        with patch.object(queryset_class, "update", autospec=True, side_effect=failing_update):
            with self.assertRaises(CommandError) as captured:
                self.rotate(batch_size=2)
        self.assertNotIn("private database detail", str(captured.exception))
        self.assertEqual(self.raw_values(record, fields), before)

    def test_prior_batches_remain_committed_and_retry_completes(self):
        first = self.create_donation()
        second = self.create_donation()
        field = ROTATION_FIELDS[0][1][0]
        self.corrupt(second, field, "msscc:enc:v1:damaged")
        with self.assertRaises(CommandError) as captured:
            self.rotate(batch_size=1)
        self.assertIn("Committed records: 1; batches: 1.", str(captured.exception))
        with override_settings(FIELD_ENCRYPTION_KEYS=(self.primary_key,)):
            first.refresh_from_db()
        with override_settings(FIELD_ENCRYPTION_KEYS=(self.previous_key,)):
            Donation.objects.filter(pk=second.pk).update(**{field: "Repaired"})
        self.rotate(batch_size=1)
        with override_settings(FIELD_ENCRYPTION_KEYS=(self.primary_key,)):
            first.refresh_from_db()
            second.refresh_from_db()
        self.assertEqual(second.donor_first_name_encrypted, "Repaired")

    def test_missing_previous_key_fails_without_changing_ciphertext(self):
        record = self.create_membership()
        fields = ROTATION_FIELDS[1][1]
        before = self.raw_values(record, fields)
        with override_settings(FIELD_ENCRYPTION_KEYS=(self.primary_key,)):
            with self.assertRaises(CommandError):
                call_command("rotate_financial_pii", confirm=True, stdout=self.output)
        self.assertEqual(self.raw_values(record, fields), before)

    def test_new_and_updated_values_use_primary_key_after_rotation(self):
        record = self.create_membership()
        self.rotate()
        with override_settings(FIELD_ENCRYPTION_KEYS=(self.primary_key, self.previous_key)):
            record.refresh_from_db()
            record.email_encrypted = "updated@example.test"
            record.save(update_fields=["email_encrypted"])
            donation = Donation.objects.create(
                amount=Decimal("5.00"), donation_date=date(2026, 10, 21), is_anonymous=False,
                message="", reference_id="new-primary", donor_email_encrypted="new@example.test",
            )
        with override_settings(FIELD_ENCRYPTION_KEYS=(self.primary_key,)):
            record.refresh_from_db()
            donation.refresh_from_db()
        self.assertEqual(record.email_encrypted, "updated@example.test")
        self.assertEqual(donation.donor_email_encrypted, "new@example.test")
        with override_settings(FIELD_ENCRYPTION_KEYS=(self.previous_key,)):
            with self.assertRaises(EncryptedTextError):
                decrypt_text(self.raw_values(record, ("email_encrypted",))[0])

    def test_empty_tables_complete_with_zero_counts(self):
        self.rotate()
        self.assertEqual(
            self.output.getvalue(), "Rotation complete. Committed records: 0; batches: 0.\n",
        )
