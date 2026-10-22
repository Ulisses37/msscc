from django.core.exceptions import ImproperlyConfigured
from django.core.management.base import BaseCommand, CommandError
from django.db import DatabaseError, transaction

from config.encryption import EncryptedTextError, encrypt_text
from donations.models import Donation, Membership

ROTATION_FIELDS = (
    (
        Donation,
        ("donor_first_name_encrypted", "donor_last_name_encrypted", "donor_email_encrypted"),
    ),
    (
        Membership,
        ("first_name_encrypted", "last_name_encrypted", "email_encrypted", "phone_encrypted"),
    ),
)
MAX_BATCH_SIZE = 1000


class Command(BaseCommand):
    """Rotate only financial PII using the configured primary encryption key."""

    help = "Re-encrypt donation and membership PII in bounded transactional batches."

    def add_arguments(self, parser):
        """Require deliberate writes and bound the number of locked rows."""
        parser.add_argument("--confirm", action="store_true", help="Confirm database writes.")
        parser.add_argument("--batch-size", type=int, default=100, help="Rows per batch (1-1000).")

    def handle(self, *args, **options):
        """Stop on failure without disclosing record data or exception details."""
        if not options["confirm"]:
            raise CommandError("Rotation requires --confirm and coordinated deployment approval.")
        batch_size = options["batch_size"]
        if not 1 <= batch_size <= MAX_BATCH_SIZE:
            raise CommandError("Batch size must be between 1 and 1000.")

        records = batches = 0
        try:
            # Validate even when all rows are NULL or the tables are empty.
            encrypt_text("")
            for model, fields in ROTATION_FIELDS:
                last_pk = 0
                upper_pk = model.objects.order_by("-pk").values_list("pk", flat=True).first()
                if upper_pk is None:
                    continue
                while last_pk < upper_pk:
                    with transaction.atomic():
                        # Locks cover both decryption and writes, preventing stale overwrites.
                        rows = list(
                            model.objects.select_for_update()
                            .filter(pk__gt=last_pk, pk__lte=upper_pk)
                            .order_by("pk")
                            .only(model._meta.pk.name, *fields)[:batch_size]
                        )
                        for row in rows:
                            # Field hooks accept plaintext and encrypt with the primary key.
                            # QuerySet.update avoids auto_now and model save side effects.
                            model.objects.filter(pk=row.pk).update(
                                **{field: getattr(row, field) for field in fields}
                            )
                    if not rows:
                        break
                    records += len(rows)
                    batches += 1
                    last_pk = rows[-1].pk
                    self.stdout.write(f"Committed records: {records}; batches: {batches}.")
        except (ImproperlyConfigured, AttributeError, EncryptedTextError, DatabaseError):
            raise CommandError(
                f"Rotation stopped. Committed records: {records}; batches: {batches}. "
                "The failing batch was rolled back. "
                "Retain all keys, resolve the failure, and retry."
            ) from None

        self.stdout.write(f"Rotation complete. Committed records: {records}; batches: {batches}.")
