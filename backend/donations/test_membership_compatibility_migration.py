from datetime import UTC, date, datetime
from decimal import Decimal

from django.db import IntegrityError, connection, models, transaction
from django.db.migrations.executor import MigrationExecutor
from django.db.models.functions import Cast
from django.test import TransactionTestCase

TARGET = [("donations", "0014_membership_annual_history")]


class MembershipCompatibilityMigrationTests(TransactionTestCase):
    """Preserve existing records across both legacy-schema and annual-history migrations."""

    def setUp(self):
        self.latest = MigrationExecutor(connection).loader.graph.leaf_nodes()
        self.addCleanup(self.restore_latest_migrations)

    def restore_latest_migrations(self):
        """Restore the latest isolated test schema even after an assertion fails."""
        MigrationExecutor(connection).migrate(self.latest)

    def migrate_to(self, name):
        """Return historical models only after migrating the isolated test database."""
        targets = [("donations", name)]
        executor = MigrationExecutor(connection)
        executor.migrate(targets)
        return executor.loader.project_state(targets).apps

    def snapshot(self, model, pk, include_address=False):
        """Capture all original fields plus ciphertext to detect re-encryption."""
        fields = [
            "first_name_encrypted", "last_name_encrypted", "email_encrypted", "phone_encrypted",
        ]
        if include_address:
            fields.append("address_encrypted")
        return model.objects.annotate(**{
            f"stored_{field}": Cast(field, output_field=models.TextField()) for field in fields
        }).values().get(pk=pk)

    def membership_values(self):
        """Supply existing non-null business facts independently of checkout pricing."""
        return {
            "first_name_encrypted": "Maya 松山", "last_name_encrypted": "O'Connor",
            "email_encrypted": "maya@example.test", "phone_encrypted": "555-0100",
            "membership_type": "historical", "amount_paid": Decimal("12.50"),
            "payment_status": "paid by check", "start_date": date(2010, 1, 1),
            "end_date": date(2010, 12, 31), "renewal_date": date(2011, 1, 1),
            "reference_id": "original-reference", "status": "active", "notes": "Original notes",
        }

    def test_full_migration_chain_preserves_existing_memberships_without_inferred_history(self):
        apps = self.migrate_to("0012_membership_processing_cost_amounts")
        old = apps.get_model("donations", "Membership")
        snapshots = []
        for index, source in enumerate(("manual", "checkout")):
            member = old.objects.create(
                **self.membership_values(),
                checkout_reference="MEM-" + "a" * 32 if source == "checkout" else None,
                stripe_payment_intent_id=(
                    "pi_test_migration_chain" if source == "checkout" else None
                ),
            )
            old.objects.filter(pk=member.pk).update(
                created_at=datetime(2010, 1, 1, 12, tzinfo=UTC),
                updated_at=datetime(2011, 1, 1, 12, tzinfo=UTC),
                reference_id=f"original-{index}",
            )
            snapshots.append((member.pk, source, self.snapshot(old, member.pk)))
        apps = self.migrate_to(TARGET[0][1])
        membership = apps.get_model("donations", "Membership")
        history = apps.get_model("donations", "MembershipAnnualHistory")
        for pk, source, before in snapshots:
            after = self.snapshot(membership, pk)
            self.assertEqual(after.pop("record_source"), source)
            self.assertIsNone(after.pop("membership_price"))
            self.assertIsNone(after.pop("address_encrypted"))
            self.assertEqual(after, before)
        self.assertEqual(membership.objects.count(), 2)
        self.assertFalse(history.objects.exists())

    def test_history_migration_preserves_legacy_address_dues_and_null_payment_facts(self):
        apps = self.migrate_to("0013_membership_legacy_fields")
        old = apps.get_model("donations", "Membership")
        snapshots = []
        for unknown in (False, True):
            values = self.membership_values()
            if unknown:
                values.update(dict.fromkeys((
                    "amount_paid", "payment_status", "start_date", "end_date", "renewal_date",
                )))
            member = old.objects.create(
                **values, membership_price=Decimal("35.25"), record_source="legacy_import",
                address_encrypted="123 Private Street\n日本",
            )
            snapshots.append((member.pk, self.snapshot(old, member.pk, include_address=True)))
        apps = self.migrate_to(TARGET[0][1])
        membership = apps.get_model("donations", "Membership")
        history = apps.get_model("donations", "MembershipAnnualHistory")
        self.assertFalse(history.objects.exists())
        for pk, before in snapshots:
            self.assertEqual(self.snapshot(membership, pk, include_address=True), before)
            history.objects.create(membership_id=pk, year=2100, is_active=True)
            with self.assertRaises(IntegrityError), transaction.atomic():
                history.objects.create(membership_id=pk, year=2100, is_active=False)
            self.assertEqual(self.snapshot(membership, pk, include_address=True), before)
        self.assertEqual(history.objects.count(), 2)
