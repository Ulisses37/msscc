import io
import logging
import traceback
from contextlib import redirect_stderr, redirect_stdout
from datetime import date
from decimal import Decimal
from importlib import import_module
from types import SimpleNamespace
from unittest.mock import patch

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.db.migrations.recorder import MigrationRecorder
from django.test import TransactionTestCase, override_settings

from config.encryption import ENCRYPTED_TEXT_ENVELOPE_PREFIX, EncryptedTextError, decrypt_text
from config.fields import encrypt_text

MIGRATE_FROM = [("donations", "0008_encrypted_pii_fields")]
MIGRATE_TO = [("donations", "0009_backfill_encrypted_pii")]
MIGRATION_MODULE = "donations.migrations.0009_backfill_encrypted_pii"


class EncryptedPIIMigrationTests(TransactionTestCase):
    """Exercise actual migration transactions, including rollback, on isolated SQLite."""

    def setUp(self):
        # TransactionTestCase is necessary to test the migration's own commit boundary.
        executor = MigrationExecutor(connection)
        self.latest = executor.loader.graph.leaf_nodes()
        self.addCleanup(self.restore_latest_migrations)
        executor.migrate(MIGRATE_FROM)
        self.apps = executor.loader.project_state(MIGRATE_FROM).apps
        self.migration = import_module(MIGRATION_MODULE)

    def restore_latest_migrations(self):
        """Restore the graph so other tests never inherit an old migration state."""
        MigrationExecutor(connection).migrate(self.latest)

    def create_donation(self, **overrides):
        """Create fictional pre-backfill donation data."""
        model = self.apps.get_model("donations", "Donation")
        data = {
            "donor_first_name": "松山 Jane",
            "donor_last_name": "O'Connor ☕",
            "donor_email": "donor@example.test",
            "amount": Decimal("12.50"),
            "donation_date": date(2026, 10, 21),
            "is_anonymous": False,
            "message": "Fictional donation note",
            "reference_id": "DON-FICTIONAL",
        }
        return model.objects.create(**(data | overrides))

    def create_membership(self, **overrides):
        """Create fictional pre-backfill membership data."""
        model = self.apps.get_model("donations", "Membership")
        data = {
            "first_name": "東京 Anne-Marie",
            "last_name": "O'Example",
            "email": "member@example.test",
            "phone": "+1 (202) 555-0100",
            "membership_type": "individual",
            "amount_paid": Decimal("25.00"),
            "start_date": date(2026, 10, 21),
            "end_date": date(2027, 10, 21),
            "renewal_date": date(2027, 10, 21),
            "payment_status": "pending",
            "reference_id": "MEM-FICTIONAL",
            "checkout_reference": "MCHK-fictional",
            "stripe_payment_intent_id": "pi_test_fictional",
            "expected_amount": Decimal("25.00"),
            "currency": "usd",
            "status": "pending",
            "notes": "Fictional membership note",
        }
        return model.objects.create(**(data | overrides))

    def migrate_forward(self):
        """Execute the actual RunPython operation through Django's executor."""
        MigrationExecutor(connection).migrate(MIGRATE_TO)

    def raw_destinations(self, record, pairs):
        """Read ciphertext directly without invoking custom-field conversion."""
        quote = connection.ops.quote_name
        columns = ", ".join(quote(record._meta.get_field(dest).column) for _, dest in pairs)
        table = quote(record._meta.db_table)
        primary_key = quote(record._meta.pk.column)
        with connection.cursor() as cursor:
            cursor.execute(
                f"SELECT {columns} FROM {table} WHERE {primary_key} = %s", [record.pk]
            )
            return dict(zip((dest for _, dest in pairs), cursor.fetchone(), strict=True))

    def pairs_for(self, record):
        """Get the migration's source/destination mapping for a historical record."""
        return dict(self.migration.PII_FIELDS)[record._meta.object_name]

    def test_backfill_preserves_plaintext_and_every_other_record_column(self):
        records = [self.create_donation(), self.create_membership()]
        before = {
            record._meta.object_name: {
                field.attname: getattr(record, field.attname)
                for field in record._meta.concrete_fields
                if not field.name.endswith("_encrypted")
            }
            for record in records
        }

        self.migrate_forward()

        for record in records:
            record.refresh_from_db()
            pairs = self.pairs_for(record)
            raw = self.raw_destinations(record, pairs)
            for source, destination in pairs:
                with self.subTest(model=record._meta.object_name, field=source):
                    original = before[record._meta.object_name][source]
                    self.assertEqual(getattr(record, destination), original)
                    self.assertTrue(raw[destination].startswith(ENCRYPTED_TEXT_ENVELOPE_PREFIX))
                    self.assertNotEqual(raw[destination], original)
                    self.assertEqual(decrypt_text(raw[destination]), original)
            for field, original in before[record._meta.object_name].items():
                self.assertEqual(getattr(record, field), original)

    def test_blank_and_whitespace_values_retain_their_meaning(self):
        records = [
            self.create_donation(donor_first_name="", donor_last_name="  ", donor_email=""),
            self.create_membership(first_name="", last_name="  ", email="", phone=""),
        ]
        self.migrate_forward()
        for record in records:
            record.refresh_from_db()
            for source, destination in self.pairs_for(record):
                self.assertEqual(getattr(record, destination), getattr(record, source))
                raw = self.raw_destinations(record, self.pairs_for(record))
                self.assertIsNotNone(raw[destination])

    def test_defensive_null_mapping_preserves_none(self):
        # Legacy columns forbid SQL NULL, so exercise defensive handling at the helper boundary.
        for _, pairs in self.migration.PII_FIELDS:
            record = SimpleNamespace(**{name: None for pair in pairs for name in pair})
            self.assertEqual(
                self.migration.destination_values(record, pairs),
                {destination: None for _, destination in pairs},
            )

    def test_existing_ciphertext_and_encrypted_blanks_are_not_reencrypted(self):
        records = [
            self.create_donation(
                donor_first_name_encrypted="Already stored", donor_email_encrypted=""
            ),
            self.create_membership(first_name_encrypted="Already stored", phone_encrypted=""),
        ]
        before = [self.raw_destinations(record, self.pairs_for(record)) for record in records]
        self.migrate_forward()
        for record, previous in zip(records, before, strict=True):
            current = self.raw_destinations(record, self.pairs_for(record))
            for destination, ciphertext in previous.items():
                if ciphertext is not None:
                    self.assertEqual(current[destination], ciphertext)
        populated = [self.raw_destinations(record, self.pairs_for(record)) for record in records]
        # Reverse is deliberately a no-op; executing forward again must be idempotent.
        MigrationExecutor(connection).migrate(MIGRATE_FROM)
        self.migrate_forward()
        self.assertEqual(
            [self.raw_destinations(record, self.pairs_for(record)) for record in records], populated
        )

    def test_invalid_configuration_fails_even_with_empty_tables(self):
        for keyring in (None, (), ("fictional-invalid-key",)):
            with self.subTest(keyring=keyring):
                with override_settings(FIELD_ENCRYPTION_KEYS=keyring):
                    with self.assertRaises(ImproperlyConfigured):
                        self.migrate_forward()
                self.assertNotIn(MIGRATE_TO[0], MigrationRecorder(connection).applied_migrations())

    def test_missing_configuration_fails_before_processing_records(self):
        with override_settings():
            del settings.FIELD_ENCRYPTION_KEYS
            with self.assertRaises(ImproperlyConfigured):
                self.migrate_forward()
        self.assertNotIn(MIGRATE_TO[0], MigrationRecorder(connection).applied_migrations())

    def test_encryption_failure_rolls_back_earlier_writes_without_disclosure(self):
        donation = self.create_donation()
        membership = self.create_membership()
        output = io.StringIO()
        logs = io.StringIO()
        handler = logging.StreamHandler(logs)
        logger = logging.getLogger()
        logger.addHandler(handler)
        self.addCleanup(logger.removeHandler, handler)

        def fail_after_donation(value):
            if value == membership.first_name:
                # Prove an earlier write happened inside the still-uncommitted migration.
                self.assertIsNotNone(self.raw_destinations(donation, self.pairs_for(donation))[
                    "donor_first_name_encrypted"
                ])
                raise ValueError("fictional-sensitive-failure-value")
            return encrypt_text(value)

        with patch("config.fields.encrypt_text", side_effect=fail_after_donation):
            with redirect_stdout(output), redirect_stderr(output):
                with self.assertRaises(EncryptedTextError) as captured:
                    self.migrate_forward()

        error = "".join(traceback.format_exception(captured.exception))
        self.assertNotIn("fictional-sensitive-failure-value", error)
        self.assertEqual(output.getvalue(), "")
        self.assertEqual(logs.getvalue(), "")
        for record in (donation, membership):
            record.refresh_from_db()
            raw = self.raw_destinations(record, self.pairs_for(record))
            self.assertTrue(all(value is None for value in raw.values()))
        self.assertNotIn(MIGRATE_TO[0], MigrationRecorder(connection).applied_migrations())

    def test_success_emits_no_console_output_or_logs(self):
        self.create_donation()
        self.create_membership()
        output = io.StringIO()
        with self.assertNoLogs(level="DEBUG"):
            with redirect_stdout(output), redirect_stderr(output):
                self.migrate_forward()
        self.assertEqual(output.getvalue(), "")

    def test_malformed_existing_destination_stops_without_overwriting_it(self):
        record = self.create_donation()
        malformed = "msscc:enc:v1:fictional-invalid-token"
        # Bypass field preparation only to simulate damaged isolated test storage.
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE donations_donation SET donor_first_name_encrypted = %s "
                "WHERE donation_id = %s",
                [malformed, record.pk],
            )
        with self.assertRaises(EncryptedTextError) as captured:
            self.migrate_forward()
        self.assertNotIn(malformed, "".join(traceback.format_exception(captured.exception)))
        raw = self.raw_destinations(record, self.pairs_for(record))
        self.assertEqual(raw["donor_first_name_encrypted"], malformed)
        self.assertIsNone(raw["donor_last_name_encrypted"])
        self.assertNotIn(MIGRATE_TO[0], MigrationRecorder(connection).applied_migrations())
        # Restore the deliberately corrupted fixture before migration-state cleanup.
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE donations_donation SET donor_first_name_encrypted = NULL "
                "WHERE donation_id = %s",
                [record.pk],
            )

