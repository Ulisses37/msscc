from datetime import UTC, date, datetime
from decimal import Decimal

from django.db import connection, models
from django.db.migrations.executor import MigrationExecutor
from django.db.models.functions import Cast
from django.test import TransactionTestCase

MIGRATE_FROM = [("donations", "0012_membership_processing_cost_amounts")]
MIGRATE_TO = [("donations", "0013_membership_legacy_fields")]


class MembershipLegacyMigrationTests(TransactionTestCase):
    """Verify source backfill changes no existing business values or encrypted ciphertext."""

    def setUp(self):
        executor = MigrationExecutor(connection)
        self.latest = executor.loader.graph.leaf_nodes()
        self.addCleanup(self.restore_latest_migrations)
        executor.migrate(MIGRATE_FROM)
        self.old_membership = executor.loader.project_state(MIGRATE_FROM).apps.get_model(
            "donations", "Membership",
        )

    def restore_latest_migrations(self):
        """Restore the current schema before subsequent tests run."""
        MigrationExecutor(connection).migrate(self.latest)

    def snapshot(self, model, pk):
        """Include ciphertext alongside every original field to catch accidental rewrites."""
        ciphertext_fields = {
            f"stored_{field}": Cast(field, output_field=models.TextField())
            for field in (
                "first_name_encrypted", "last_name_encrypted", "email_encrypted", "phone_encrypted",
            )
        }
        return model.objects.annotate(**ciphertext_fields).values().get(pk=pk)

    def test_source_backfill_preserves_every_existing_field(self):
        snapshots = []
        for index, (checkout_reference, intent_id, source) in enumerate((
            (None, None, "manual"),
            ("MEM-" + "a" * 32, "pi_test_linked", "checkout"),
            ("MEM-" + "b" * 32, None, "checkout"),
            (None, "pi_test_partial", "checkout"),
            ("", "", "manual"),
        )):
            member = self.old_membership.objects.create(
                first_name_encrypted="Maya", last_name_encrypted="O'Connor 松山",
                email_encrypted=None if index == 0 else "maya@example.test",
                phone_encrypted=None if index == 0 else "",
                membership_type="Historical membership", amount_paid=Decimal("35.25"),
                start_date=date(2010, 1, 1), end_date=date(2010, 12, 31),
                renewal_date=date(2011, 1, 1), payment_status="paid by check",
                reference_id=f"historical-{index}", status="active", notes="Original notes",
                checkout_reference=checkout_reference, stripe_payment_intent_id=intent_id,
                membership_option_id="individual" if source == "checkout" else None,
                expected_amount=Decimal("35.00") if source == "checkout" else None,
                base_amount=Decimal("35.00") if source == "checkout" else None,
                currency="usd", completed_at=datetime(2010, 1, 1, 12, tzinfo=UTC),
            )
            self.old_membership.objects.filter(pk=member.pk).update(
                created_at=datetime(2010, 1, 1, 12, tzinfo=UTC),
                updated_at=datetime(2011, 1, 1, 12, tzinfo=UTC),
            )
            snapshots.append((member.pk, source, self.snapshot(self.old_membership, member.pk)))

        executor = MigrationExecutor(connection)
        executor.migrate(MIGRATE_TO)
        membership = executor.loader.project_state(MIGRATE_TO).apps.get_model(
            "donations", "Membership",
        )
        for pk, source, before in snapshots:
            with self.subTest(pk=pk):
                after = self.snapshot(membership, pk)
                self.assertEqual(after.pop("record_source"), source)
                self.assertIsNone(after.pop("membership_price"))
                self.assertIsNone(after.pop("address_encrypted"))
                self.assertEqual(after, before)

    def test_migrated_schema_accepts_unknown_historical_facts(self):
        executor = MigrationExecutor(connection)
        executor.migrate(MIGRATE_TO)
        membership = executor.loader.project_state(MIGRATE_TO).apps.get_model(
            "donations", "Membership",
        )
        member = membership.objects.create(
            membership_type="Historical", status="active", reference_id="import-test",
            notes="Unknown facts", record_source="legacy_import",
        )
        member.full_clean()
        member.refresh_from_db()
        for field in (
            "email_encrypted", "phone_encrypted", "start_date", "end_date", "renewal_date",
            "amount_paid", "payment_status", "membership_price", "address_encrypted",
        ):
            self.assertIsNone(getattr(member, field))
