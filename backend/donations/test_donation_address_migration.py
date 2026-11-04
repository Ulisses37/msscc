from datetime import date

from django.db import connection, models
from django.db.migrations.executor import MigrationExecutor
from django.db.models.functions import Cast
from django.test import TransactionTestCase

MIGRATE_FROM = [("donations", "0015_donation_receipt_sent_at_membership_receipt_sent_at")]
MIGRATE_TO = [("donations", "0016_donation_donor_address_encrypted")]


class DonationAddressMigrationTests(TransactionTestCase):
    """Ensure the new column preserves historical facts and encrypted contact values."""

    def test_existing_donations_keep_all_values_and_receive_only_null_addresses(self):
        executor = MigrationExecutor(connection)
        latest = executor.loader.graph.leaf_nodes()
        self.addCleanup(lambda: MigrationExecutor(connection).migrate(latest))
        executor.migrate(MIGRATE_FROM)
        old = executor.loader.project_state(MIGRATE_FROM).apps.get_model("donations", "Donation")
        for anonymous in (True, False):
            old.objects.create(
                donor_first_name_encrypted="Historical", donor_last_name_encrypted="松山",
                donor_email_encrypted="historical@example.test", amount="12.50",
                total_amount="12.50", donation_date=date(2010, 1, 2), is_anonymous=anonymous,
                message="Unchanged", reference_id=f"historical-{anonymous}",
            )

        def snapshots(model):
            return list(model.objects.annotate(**{
                f"stored_{field}": Cast(field, output_field=models.TextField())
                for field in (
                    "donor_first_name_encrypted", "donor_last_name_encrypted",
                    "donor_email_encrypted",
                )
            }).order_by("pk").values())

        before = snapshots(old)
        executor = MigrationExecutor(connection)
        executor.migrate(MIGRATE_TO)
        new = executor.loader.project_state(MIGRATE_TO).apps.get_model("donations", "Donation")
        after = snapshots(new)
        for row in after:
            self.assertIsNone(row.pop("donor_address_encrypted"))
        self.assertEqual(after, before)
