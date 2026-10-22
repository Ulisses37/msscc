from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import DatabaseError, migrations

from config.encryption import EncryptedTextError, encrypt_text

ENCRYPTED_FIELDS = (
    ("Donation", (
        "donor_first_name_encrypted", "donor_last_name_encrypted", "donor_email_encrypted",
    )),
    ("Membership", (
        "first_name_encrypted", "last_name_encrypted", "email_encrypted", "phone_encrypted",
    )),
)


def verify_encrypted_pii(apps, schema_editor):
    """Require complete, authenticated encrypted destinations before dropping any source."""
    try:
        if not hasattr(settings, "FIELD_ENCRYPTION_KEYS"):
            raise ImproperlyConfigured("Encryption configuration is required.")
        encrypt_text("")
        database = schema_editor.connection.alias
        for model_name, fields in ENCRYPTED_FIELDS:
            model = apps.get_model("donations", model_name)
            records = model.objects.using(database).only("pk", *fields).order_by("pk")
            # Loading authenticates every destination. Empty encrypted strings are valid;
            # NULL means the backfill or a later write left a destination incomplete.
            # Do not compare stale sources with authoritative encrypted-only updates.
            for record in records.iterator(chunk_size=500):
                if any(getattr(record, field) is None for field in fields):
                    raise EncryptedTextError("Encrypted PII verification failed.")
    except ImproperlyConfigured:
        raise ImproperlyConfigured(
            "PII removal requires valid encryption configuration."
        ) from None
    except (ValueError, TypeError, DatabaseError):
        raise EncryptedTextError(
            "Encrypted PII verification failed; plaintext columns were not removed."
        ) from None


class Migration(migrations.Migration):
    """Verify destinations, then remove only the seven legacy PII columns."""

    atomic = True

    dependencies = [
        ("donations", "0009_backfill_encrypted_pii"),
    ]

    # Reversal restores schema only, never the removed plaintext values. Historical
    # PII cannot be recovered by reversing this migration; preserve encrypted columns.
    operations = [
        migrations.RunPython(verify_encrypted_pii, reverse_code=migrations.RunPython.noop),
        migrations.RemoveField(model_name="donation", name="donor_first_name"),
        migrations.RemoveField(model_name="donation", name="donor_last_name"),
        migrations.RemoveField(model_name="donation", name="donor_email"),
        migrations.RemoveField(model_name="membership", name="first_name"),
        migrations.RemoveField(model_name="membership", name="last_name"),
        migrations.RemoveField(model_name="membership", name="email"),
        migrations.RemoveField(model_name="membership", name="phone"),
    ]