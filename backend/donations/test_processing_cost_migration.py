from datetime import date
from decimal import Decimal

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

MIGRATE_FROM = [("donations", "0010_remove_plaintext_pii")]
MIGRATE_TO = [("donations", "0011_donation_processing_cost_amounts")]


class DonationProcessingCostMigrationTests(TransactionTestCase):
    """Apply the real migration to a populated pre-contribution donation table."""

    def setUp(self):
        executor = MigrationExecutor(connection)
        self.latest = executor.loader.graph.leaf_nodes()
        self.addCleanup(self.restore_latest_migrations)
        executor.migrate(MIGRATE_FROM)
        self.old_donation = executor.loader.project_state(MIGRATE_FROM).apps.get_model(
            "donations", "Donation"
        )

    def restore_latest_migrations(self):
        """Leave the schema at the current graph leaf for subsequent tests."""
        MigrationExecutor(connection).migrate(self.latest)

    def test_legacy_rows_keep_original_money_and_get_no_contribution(self):
        records = []
        for index, (amount, state) in enumerate((
            (Decimal("0.01"), "completed"),
            (Decimal("12.50"), "pending"),
            (Decimal("99999999.99"), "failed"),
        )):
            record = self.old_donation.objects.create(
                donor_first_name_encrypted="Test",
                donor_last_name_encrypted="Donor",
                donor_email_encrypted="donor@example.test",
                amount=amount, currency="usd", donation_date=date(2026, 10, 21),
                is_anonymous=False, message="Legacy donation",
                payment_status=state, reference_id=f"DON-{index:08d}",
            )
            records.append((record.pk, amount, state, record.reference_id))

        executor = MigrationExecutor(connection)
        executor.migrate(MIGRATE_TO)
        new_donation = executor.loader.project_state(MIGRATE_TO).apps.get_model(
            "donations", "Donation"
        )
        for pk, amount, state, reference in records:
            with self.subTest(reference=reference):
                record = new_donation.objects.get(pk=pk)
                self.assertEqual(record.amount, amount)
                self.assertEqual(record.total_amount, amount)
                self.assertEqual(record.processing_cost_contribution, Decimal("0.00"))
                self.assertFalse(record.contribute_to_processing_costs)
                self.assertEqual(record.payment_status, state)
                self.assertEqual(record.reference_id, reference)


class MembershipProcessingCostMigrationTests(TransactionTestCase):
    """Adding fee fields must not reinterpret payments made before opt-in existed."""

    def setUp(self):
        executor = MigrationExecutor(connection)
        self.latest = executor.loader.graph.leaf_nodes()
        self.addCleanup(self.restore_latest_migrations)
        executor.migrate(MIGRATE_TO)
        self.old_membership = executor.loader.project_state(MIGRATE_TO).apps.get_model(
            "donations", "Membership"
        )

    def restore_latest_migrations(self):
        MigrationExecutor(connection).migrate(self.latest)

    def test_existing_manual_and_checkout_memberships_keep_their_amounts(self):
        records = []
        # Cover a manually entered payment (no expected price) and an older
        # checkout payment (with a price and Stripe references).
        for index, (paid, expected, state) in enumerate((
            (Decimal("75.25"), None, "active"),
            (Decimal("20.00"), Decimal("20.00"), "completed"),
        )):
            record = self.old_membership.objects.create(
                first_name_encrypted="Legacy", last_name_encrypted="Member",
                email_encrypted=f"legacy{index}@example.test", phone_encrypted="",
                membership_type="student", membership_option_id="student" if expected else None,
                amount_paid=paid, expected_amount=expected, currency="usd",
                checkout_reference="MEM-" + "a" * 32 if expected else None,
                stripe_payment_intent_id=f"pi_legacy_{index}" if expected else None,
                start_date=date(2026, 10, 21), end_date=date(2027, 10, 20),
                renewal_date=date(2027, 10, 21),
                payment_status=state, status=state, notes="legacy",
                reference_id=f"legacy-{index}",
            )
            records.append((
                record.pk, paid, expected, state,
                record.checkout_reference, record.stripe_payment_intent_id,
            ))

        executor = MigrationExecutor(connection)
        # Read through the post-migration model: old rows must retain their
        # original amounts, while the new fee breakdown remains unknown/zero.
        executor.migrate([("donations", "0012_membership_processing_cost_amounts")])
        new_membership = executor.loader.project_state(
            [("donations", "0012_membership_processing_cost_amounts")]
        ).apps.get_model("donations", "Membership")
        for pk, paid, expected, state, checkout_reference, intent_id in records:
            with self.subTest(pk=pk):
                record = new_membership.objects.get(pk=pk)
                self.assertEqual(record.amount_paid, paid)
                self.assertEqual(record.expected_amount, expected)
                self.assertEqual(record.payment_status, state)
                self.assertEqual(record.checkout_reference, checkout_reference)
                self.assertEqual(record.stripe_payment_intent_id, intent_id)
                self.assertFalse(record.contribute_to_processing_costs)
                self.assertEqual(record.processing_cost_contribution, Decimal("0.00"))
                self.assertIsNone(record.base_amount)
