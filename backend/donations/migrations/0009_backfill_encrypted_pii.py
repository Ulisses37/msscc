from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import DatabaseError, migrations, transaction

from config.encryption import EncryptedTextError, encrypt_text

PII_FIELDS = (
    (
        "Donation",
        (
            ("donor_first_name", "donor_first_name_encrypted"),
            ("donor_last_name", "donor_last_name_encrypted"),
            ("donor_email", "donor_email_encrypted"),
        ),
    ),
    (
        "Membership",
        (
            ("first_name", "first_name_encrypted"),
            ("last_name", "last_name_encrypted"),
            ("email", "email_encrypted"),
            ("phone", "phone_encrypted"),
        ),
    ),
)


def destination_values(record, field_pairs):
    """Copy only missing destinations, preserving legacy blank and null semantics."""
    # EncryptedTextField authenticates/decrypts populated columns during loading.
    # Testing for None also preserves already encrypted empty strings unchanged.
    return {
        destination: getattr(record, source)
        for source, destination in field_pairs
        if getattr(record, destination) is None
    }


def backfill_encrypted_pii(apps, schema_editor):
    """Backfill historical PII atomically without changing plaintext or timestamps."""
    try:
        if not hasattr(settings, "FIELD_ENCRYPTION_KEYS"):
            raise ImproperlyConfigured("FIELD_ENCRYPTION_KEYS is required.")
        # Validate even when tables are empty or every destination is populated.
        encrypt_text("")
        database = schema_editor.connection.alias
        # Roll back failed writes before the schema editor performs its exit checks.
        with transaction.atomic(using=database):
            for model_name, field_pairs in PII_FIELDS:
                model = apps.get_model("donations", model_name)
                fields = [name for pair in field_pairs for name in pair]
                records = model.objects.using(database).only("pk", *fields).order_by("pk")
                for record in records.iterator(chunk_size=500):
                    values = destination_values(record, field_pairs)
                    if values:
                        # Queryset updates encrypt via field preparation, without save()
                        # or auto_now changes to the historical record's timestamps.
                        model.objects.using(database).filter(pk=record.pk).update(**values)
    except ImproperlyConfigured:
        raise ImproperlyConfigured("PII backfill requires valid encryption configuration.") from None
    except (ValueError, TypeError, DatabaseError):
        # Underlying exceptions can contain PII or SQL parameters. Do not chain them.
        raise EncryptedTextError("PII backfill failed; the migration was not completed.") from None


class Migration(migrations.Migration):
    """Populate encrypted destinations while retaining all legacy columns."""

    atomic = True

    dependencies = [
        ("donations", "0008_encrypted_pii_fields"),
    ]

    operations = [
        migrations.RunPython(backfill_encrypted_pii, reverse_code=migrations.RunPython.noop),
    ]
