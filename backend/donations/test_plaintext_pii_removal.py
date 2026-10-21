import io
import traceback
from contextlib import redirect_stderr, redirect_stdout
from datetime import date
from importlib import import_module

from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.core.exceptions import ImproperlyConfigured
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.db.migrations.recorder import MigrationRecorder
from django.test import TransactionTestCase, override_settings
from rest_framework.test import APIClient

from config.encryption import EncryptedTextError, decrypt_text
from donations.models import Donation, Membership

MIGRATE_FROM = [("donations", "0008_encrypted_pii_fields")]
BACKFILLED = [("donations", "0009_backfill_encrypted_pii")]
MIGRATE_TO = [("donations", "0010_remove_plaintext_pii")]


class PlaintextPIIRemovalTests(TransactionTestCase):
    """Verify real column removal and fail-closed checks in isolated test storage."""

    def setUp(self):
        executor = MigrationExecutor(connection)
        self.latest = executor.loader.graph.leaf_nodes()
        self.addCleanup(self.restore_latest_migrations)
        executor.migrate(MIGRATE_FROM)
        self.apps = executor.loader.project_state(MIGRATE_FROM).apps
        self.backfill = import_module("donations.migrations.0009_backfill_encrypted_pii")
        self.removal = import_module("donations.migrations.0010_remove_plaintext_pii")

    def restore_latest_migrations(self):
        """Remove deliberately incomplete fixtures before restoring the final schema."""
        for name, _ in self.backfill.PII_FIELDS:
            self.apps.get_model("donations", name).objects.all().delete()
        MigrationExecutor(connection).migrate(self.latest)

    def create_records(self):
        """Seed fictional records before backfill with representative non-PII data."""
        donation = self.apps.get_model("donations", "Donation").objects.create(
            donor_first_name="松山 Maya", donor_last_name="Chen",
            donor_email="donor@example.test", amount="12.50", currency="usd",
            donation_date=date(2026, 10, 21), is_anonymous=False, message="Keep message",
            payment_status="completed", reference_id="DON-00000042",
        )
        member = self.apps.get_model("donations", "Membership").objects.create(
            first_name="松山 Maya", last_name="Chen", email="member@example.test",
            phone="+1 (916) 555-0123", membership_type="student", amount_paid="20.00",
            start_date=date(2026, 10, 21), end_date=date(2027, 10, 20),
            renewal_date=date(2027, 10, 21), payment_status="completed", status="active",
            notes="Keep notes", reference_id="MEM-fictional", checkout_reference="MEM-fictional",
            stripe_payment_intent_id="pi_test_removal", membership_option_id="student",
            expected_amount="20.00", currency="usd",
        )
        return donation, member

    def columns(self, model):
        """Inspect physical columns rather than just Django's model state."""
        with connection.cursor() as cursor:
            return {
                column.name for column in connection.introspection.get_table_description(
                    cursor, model._meta.db_table,
                )
            }

    def raw_destinations(self, record, pairs):
        """Read ciphertext without field conversion for storage comparisons."""
        quote = connection.ops.quote_name
        fields = ", ".join(quote(destination) for _, destination in pairs)
        with connection.cursor() as cursor:
            cursor.execute(
                f"SELECT {fields} FROM {quote(record._meta.db_table)} "
                f"WHERE {quote(record._meta.pk.column)} = %s", [record.pk],
            )
            return dict(zip((dest for _, dest in pairs), cursor.fetchone(), strict=True))

    def assert_removal_blocked(self, exception=EncryptedTextError):
        """Require failure before any table loses a source column or migration is recorded."""
        output = io.StringIO()
        with self.assertNoLogs(level="DEBUG"):
            with redirect_stdout(output), redirect_stderr(output):
                with self.assertRaises(exception) as captured:
                    MigrationExecutor(connection).migrate(MIGRATE_TO)
        self.assertEqual(output.getvalue(), "")
        error = "".join(traceback.format_exception(captured.exception))
        for sensitive in ("松山", "example.test", "invalid-sensitive-token", "private-key"):
            self.assertNotIn(sensitive, error)
        self.assertNotIn(MIGRATE_TO[0], MigrationRecorder(connection).applied_migrations())
        for name, pairs in self.backfill.PII_FIELDS:
            columns = self.columns(self.apps.get_model("donations", name))
            for source, _ in pairs:
                self.assertIn(source, columns)

    def test_existing_records_survive_backfill_removal_reads_search_and_updates(self):
        records = self.create_records()
        before = {}
        for record in records:
            record.refresh_from_db()
            before[record._meta.object_name] = {
                field.attname: getattr(record, field.attname)
                for field in record._meta.concrete_fields
                if not field.name.endswith("_encrypted")
            }
        MigrationExecutor(connection).migrate(BACKFILLED)
        ciphertext = [
            self.raw_destinations(record, pairs)
            for record, (_, pairs) in zip(records, self.backfill.PII_FIELDS, strict=True)
        ]
        MigrationExecutor(connection).migrate(MIGRATE_TO)
        user = get_user_model().objects.create_user(
            email="removal-admin@example.test", permissions_data={"Finances": True},
        )
        self.client = APIClient()
        self.client.force_authenticate(user=user)
        for index, (model, url) in enumerate((
            (Donation, "/api/donations/"), (Membership, "/api/donations/memberships/"),
        )):
            record = model.objects.get(pk=records[index].pk)
            pairs = dict(self.backfill.PII_FIELDS)[model.__name__]
            original = before[model.__name__]
            self.assertEqual(self.columns(model), {f.column for f in model._meta.concrete_fields})
            self.assertEqual(self.raw_destinations(record, pairs), ciphertext[index])
            for source, destination in pairs:
                self.assertNotIn(source, self.columns(model))
                self.assertNotIn(source, {field.name for field in model._meta.concrete_fields})
                self.assertEqual(getattr(record, destination), original[source])
                self.assertEqual(decrypt_text(ciphertext[index][destination]), original[source])
            for field, value in original.items():
                if field not in dict(pairs):
                    self.assertEqual(getattr(record, field), value)
            for endpoint, params in ((url, {}), (f"{url}{record.pk}/", {}),
                                     (url, {"search": "松山"})):
                response = self.client.get(endpoint, params)
                self.assertEqual(response.status_code, 200)
                result = response.data[0] if endpoint == url else response.data
                for source, _ in pairs:
                    self.assertEqual(result[source], original[source])
                self.assertFalse(any(key.endswith("_encrypted") for key in result))
            source, destination = pairs[0]
            response = self.client.patch(
                f"{url}{record.pk}/", {source: "Updated Maya"}, format="json",
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data[source], "Updated Maya")
            updated = self.raw_destinations(record, pairs)
            self.assertNotEqual(updated[destination], "Updated Maya")
            self.assertEqual(decrypt_text(updated[destination]), "Updated Maya")

    def test_missing_destination_in_any_field_blocks_all_column_removal(self):
        records = self.create_records()
        MigrationExecutor(connection).migrate(BACKFILLED)
        for record, (_, pairs) in zip(records, self.backfill.PII_FIELDS, strict=True):
            for _, destination in pairs:
                with self.subTest(model=record._meta.object_name, field=destination):
                    previous = self.raw_destinations(record, pairs)[destination]
                    type(record).objects.filter(pk=record.pk).update(**{destination: None})
                    self.assert_removal_blocked()
                    type(record).objects.filter(pk=record.pk).update(
                        **{destination: decrypt_text(previous)},
                    )

    def test_invalid_ciphertext_in_either_resource_blocks_all_column_removal(self):
        records = self.create_records()
        MigrationExecutor(connection).migrate(BACKFILLED)
        for record, (_, pairs) in zip(records, self.backfill.PII_FIELDS, strict=True):
            destination = pairs[0][1]
            original = self.raw_destinations(record, pairs)[destination]
            for malformed in ("plaintext", "msscc:enc:v1:invalid-sensitive-token",
                              "msscc:enc:v2:invalid-sensitive-token"):
                with self.subTest(model=record._meta.object_name, value=malformed):
                    with connection.cursor() as cursor:
                        cursor.execute(
                            f'UPDATE "{record._meta.db_table}" SET "{destination}" = %s '
                            f'WHERE "{record._meta.pk.column}" = %s', [malformed, record.pk],
                        )
                    self.assert_removal_blocked()
            type(record).objects.filter(pk=record.pk).update(
                **{destination: decrypt_text(original)},
            )

    def test_stale_plaintext_does_not_override_authoritative_encrypted_updates(self):
        records = self.create_records()
        MigrationExecutor(connection).migrate(BACKFILLED)
        for record, (_, pairs) in zip(records, self.backfill.PII_FIELDS, strict=True):
            type(record).objects.filter(pk=record.pk).update(
                **{destination: "Updated authoritative value" for _, destination in pairs},
            )
        MigrationExecutor(connection).migrate(MIGRATE_TO)
        for model in (Donation, Membership):
            record = model.objects.get()
            for _, destination in dict(self.backfill.PII_FIELDS)[model.__name__]:
                self.assertEqual(getattr(record, destination), "Updated authoritative value")

    def test_encrypted_empty_and_whitespace_values_are_valid(self):
        records = self.create_records()
        for record, (_, pairs) in zip(records, self.backfill.PII_FIELDS, strict=True):
            type(record).objects.filter(pk=record.pk).update(
                **{source: "" if index % 2 else "  "
                   for index, (source, _) in enumerate(pairs)},
            )
        MigrationExecutor(connection).migrate(MIGRATE_TO)
        for model in (Donation, Membership):
            record = model.objects.get()
            pairs = dict(self.backfill.PII_FIELDS)[model.__name__]
            for index, (_, destination) in enumerate(pairs):
                self.assertEqual(getattr(record, destination), "" if index % 2 else "  ")

    def test_invalid_configuration_blocks_removal_even_with_empty_tables(self):
        MigrationExecutor(connection).migrate(BACKFILLED)
        for keyring in (None, (), ("private-key",)):
            with self.subTest(keyring=keyring), override_settings(FIELD_ENCRYPTION_KEYS=keyring):
                self.assert_removal_blocked(ImproperlyConfigured)
        with override_settings():
            from django.conf import settings

            del settings.FIELD_ENCRYPTION_KEYS
            self.assert_removal_blocked(ImproperlyConfigured)

    def test_wrong_valid_key_blocks_removal(self):
        self.create_records()
        MigrationExecutor(connection).migrate(BACKFILLED)
        with override_settings(FIELD_ENCRYPTION_KEYS=(Fernet.generate_key().decode("ascii"),)):
            self.assert_removal_blocked()

    def test_verification_precedes_exactly_seven_remove_field_operations(self):
        from django.db import migrations

        operations = self.removal.Migration.operations
        self.assertIsInstance(operations[0], migrations.RunPython)
        self.assertIs(operations[0].code, self.removal.verify_encrypted_pii)
        self.assertEqual(len(operations), 8)
        self.assertTrue(all(isinstance(op, migrations.RemoveField) for op in operations[1:]))
        self.assertEqual(
            {(op.model_name, op.name) for op in operations[1:]},
            {(name.lower(), source) for name, pairs in self.backfill.PII_FIELDS
             for source, _ in pairs},
        )
