from datetime import date

from django.db import connection, models
from django.db.migrations.executor import MigrationExecutor
from django.db.models.functions import Cast
from django.test import TransactionTestCase

MIGRATE_FROM = [("donations", "0017_membership_payment_method")]
MIGRATE_TO = [("donations", "0018_donation_manual_record_fields")]


class ManualDonationMigrationTests(TransactionTestCase):
    """Preserve legacy donation facts and ciphertext without inventing payment provenance."""

    def test_existing_records_receive_only_unknown_origin_method_and_blank_external_reference(self):
        executor = MigrationExecutor(connection)
        latest = executor.loader.graph.leaf_nodes()
        self.addCleanup(lambda: MigrationExecutor(connection).migrate(latest))
        executor.migrate(MIGRATE_FROM)
        old = executor.loader.project_state(MIGRATE_FROM).apps.get_model("donations", "Donation")
        for index, reference in enumerate(("DON-00000001", "cash historical reference")):
            old.objects.create(
                donor_first_name_encrypted="Historical", donor_last_name_encrypted="松山",
                donor_email_encrypted="historical@example.test",
                donor_address_encrypted="Historical address", amount="12.50", total_amount="12.50",
                donation_date=date(1990, 1, 2), is_anonymous=False, message="Original facts",
                payment_status="completed" if index else "pending", reference_id=reference,
            )

        def snapshots(model):
            return list(model.objects.annotate(**{
                f"stored_{field}": Cast(field, output_field=models.TextField())
                for field in (
                    "donor_first_name_encrypted", "donor_last_name_encrypted",
                    "donor_email_encrypted", "donor_address_encrypted",
                )
            }).order_by("pk").values())

        before = snapshots(old)
        executor = MigrationExecutor(connection)
        executor.migrate(MIGRATE_TO)
        new = executor.loader.project_state(MIGRATE_TO).apps.get_model("donations", "Donation")
        after = snapshots(new)
        for row in after:
            self.assertEqual(row.pop("record_source"), "unknown")
            self.assertIsNone(row.pop("payment_method"))
            self.assertEqual(row.pop("external_reference"), "")
        self.assertEqual(after, before)
