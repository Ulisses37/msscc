from datetime import date
from decimal import Decimal

from django.db import connection
from django.test import TestCase

from config.encryption import ENCRYPTED_TEXT_ENVELOPE_PREFIX, EncryptedTextError, decrypt_text

from .models import Donation, Membership

DONATION_FIELDS = (
    "donor_first_name_encrypted",
    "donor_last_name_encrypted",
    "donor_email_encrypted",
)
MEMBERSHIP_FIELDS = (
    "first_name_encrypted",
    "last_name_encrypted",
    "email_encrypted",
    "phone_encrypted",
)


class EncryptedPIIFieldTests(TestCase):
    """Verify ciphertext storage and decrypted model values in the final schema."""

    def create_donation(self, **overrides):
        """Create a donation with optional encrypted values."""
        data = {
            "amount": Decimal("10.00"),
            "donation_date": date(2026, 10, 21),
            "is_anonymous": False,
            "message": "Unchanged note",
            "reference_id": "DON-ENCRYPTION-TEST",
        }
        return Donation.objects.create(**(data | overrides))

    def create_membership(self, **overrides):
        """Create a membership with optional encrypted values."""
        data = {
            "membership_type": "individual",
            "amount_paid": Decimal("25.00"),
            "start_date": date(2026, 10, 21),
            "end_date": date(2027, 10, 21),
            "renewal_date": date(2027, 10, 21),
            "reference_id": "MEM-ENCRYPTION-TEST",
            "status": "pending",
            "notes": "Unchanged note",
        }
        return Membership.objects.create(**(data | overrides))

    def raw_value(self, record, field_name):
        """Read the stored column without Django's field conversion hooks."""
        quote = connection.ops.quote_name
        table = quote(record._meta.db_table)
        column = quote(record._meta.get_field(field_name).column)
        primary_key = quote(record._meta.pk.column)
        with connection.cursor() as cursor:
            cursor.execute(
                f"SELECT {column} FROM {table} WHERE {primary_key} = %s", [record.pk]
            )
            return cursor.fetchone()[0]

    def assert_encrypted_value(self, record, field_name, plaintext):
        """Check raw storage and decrypted retrieval for one destination."""
        stored = self.raw_value(record, field_name)
        if plaintext is None:
            self.assertIsNone(stored)
        else:
            self.assertTrue(stored.startswith(ENCRYPTED_TEXT_ENVELOPE_PREFIX))
            self.assertNotEqual(stored, plaintext)
            self.assertEqual(decrypt_text(stored), plaintext)
        record.refresh_from_db()
        self.assertEqual(getattr(record, field_name), plaintext)

    def test_all_destination_fields_encrypt_on_create_and_decrypt_on_read(self):
        for factory, fields in (
            (self.create_donation, DONATION_FIELDS),
            (self.create_membership, MEMBERSHIP_FIELDS),
        ):
            values = {field: f"松山 O'Connor ☕\n{field}" for field in fields}
            record = factory(**values)
            for field, plaintext in values.items():
                with self.subTest(model=type(record).__name__, field=field):
                    self.assert_encrypted_value(record, field, plaintext)

    def test_omitted_destinations_are_nullable_and_valid_before_backfill(self):
        for factory, fields in (
            (self.create_donation, DONATION_FIELDS),
            (self.create_membership, MEMBERSHIP_FIELDS),
        ):
            record = factory()
            record.full_clean()
            for field in fields:
                with self.subTest(model=type(record).__name__, field=field):
                    self.assert_encrypted_value(record, field, None)

    def test_explicit_empty_and_null_values_round_trip_for_all_destinations(self):
        for factory, fields in (
            (self.create_donation, DONATION_FIELDS),
            (self.create_membership, MEMBERSHIP_FIELDS),
        ):
            record = factory()
            for value in ("", None):
                for field in fields:
                    with self.subTest(model=type(record).__name__, field=field, value=value):
                        setattr(record, field, value)
                        record.save(update_fields=[field])
                        self.assert_encrypted_value(record, field, value)

    def test_save_and_queryset_updates_preserve_non_pii_values(self):
        for factory, fields in (
            (self.create_donation, DONATION_FIELDS),
            (self.create_membership, MEMBERSHIP_FIELDS),
        ):
            record = factory()
            unchanged = {
                field.attname: getattr(record, field.attname)
                for field in record._meta.concrete_fields
                if field.name not in fields
            }
            for field in fields:
                with self.subTest(model=type(record).__name__, field=field):
                    setattr(record, field, "Saved plaintext")
                    record.save(update_fields=[field])
                    self.assert_encrypted_value(record, field, "Saved plaintext")
                    type(record).objects.filter(pk=record.pk).update(**{field: "Updated text"})
                    self.assert_encrypted_value(record, field, "Updated text")
            for field, value in unchanged.items():
                self.assertEqual(getattr(record, field), value)

    def test_repeated_save_does_not_double_encrypt_loaded_plaintext(self):
        record = self.create_donation(donor_first_name_encrypted="Jane")
        first_ciphertext = self.raw_value(record, "donor_first_name_encrypted")
        record.refresh_from_db()
        record.save(update_fields=["donor_first_name_encrypted"])
        self.assert_encrypted_value(record, "donor_first_name_encrypted", "Jane")
        self.assertNotEqual(first_ciphertext, self.raw_value(record, "donor_first_name_encrypted"))

    def test_plaintext_with_an_envelope_prefix_is_still_encrypted(self):
        plaintext = "msscc:enc:v1:not-an-actual-token"
        record = self.create_donation(donor_first_name_encrypted=plaintext)
        self.assert_encrypted_value(record, "donor_first_name_encrypted", plaintext)

    def test_malformed_database_values_raise_controlled_errors(self):
        record = self.create_donation()
        # Corrupt only isolated test storage, bypassing the encryption write hook.
        for malformed in ("plaintext", "msscc:enc:v1:invalid-token", "msscc:enc:v2:token"):
            with self.subTest(value=malformed):
                with connection.cursor() as cursor:
                    cursor.execute(
                        "UPDATE donations_donation SET donor_first_name_encrypted = %s "
                        "WHERE donation_id = %s",
                        [malformed, record.pk],
                    )
                with self.assertRaises(EncryptedTextError):
                    record.refresh_from_db()
