from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase

from donations.models import Membership, MembershipAnnualHistory


class MembershipAnnualHistoryTests(TestCase):
    """Keep annual membership evidence separate from identity and payment data."""

    def setUp(self):
        self.membership = self.create_membership()

    def create_membership(self, **overrides):
        """Create a membership without inventing historical dates or payments."""
        data = {
            "first_name_encrypted": "Maya",
            "last_name_encrypted": "Chen",
            "membership_type": "individual",
            "status": "active",
            "reference_id": "historical-reference",
            "notes": "Historical membership",
        }
        data.update(overrides)
        return Membership.objects.create(**data)

    def create_history(self, **overrides):
        """Create annual history with an explicitly supplied state."""
        data = {"membership": self.membership, "year": 2022, "is_active": True}
        data.update(overrides)
        return MembershipAnnualHistory.objects.create(**data)

    def test_creation_preserves_explicit_active_and_inactive_states(self):
        for year, active in ((2022, True), (2023, False)):
            with self.subTest(active=active):
                history = self.create_history(year=year, is_active=active)
                history.full_clean()
                history.refresh_from_db()
                self.assertEqual(history.year, year)
                self.assertIs(history.is_active, active)

    def test_history_belongs_to_exactly_one_membership(self):
        history = self.create_history()
        self.assertEqual(history.membership, self.membership)
        self.assertEqual(list(self.membership.annual_history.all()), [history])
        other = self.create_membership()
        self.assertFalse(other.annual_history.exists())

    def test_membership_year_and_state_are_required(self):
        for field in ("membership", "year", "is_active"):
            with self.subTest(field=field):
                data = {"membership": self.membership, "year": 2022, "is_active": True}
                data.pop(field)
                history = MembershipAnnualHistory(**data)
                with self.assertRaises(ValidationError) as caught:
                    history.full_clean()
                self.assertIn(field, caught.exception.message_dict)
                with self.assertRaises(IntegrityError), transaction.atomic():
                    history.save()

    def test_valid_year_boundaries_and_future_years(self):
        for year in (1, 2100, 9999):
            with self.subTest(year=year):
                history = self.create_history(year=year)
                history.full_clean()
                history.refresh_from_db()
                self.assertEqual(history.year, year)

    def test_invalid_years_fail_validation_and_database_constraint(self):
        for year in (-1, 0, 10000):
            with self.subTest(year=year):
                history = MembershipAnnualHistory(
                    membership=self.membership, year=year, is_active=True,
                )
                with self.assertRaises(ValidationError) as caught:
                    history.full_clean()
                self.assertIn("year", caught.exception.message_dict)
                with self.assertRaises(IntegrityError), transaction.atomic():
                    history.save()

    def test_duplicate_year_fails_validation_and_database_constraint(self):
        self.create_history()
        duplicate = MembershipAnnualHistory(
            membership=self.membership, year=2022, is_active=False,
        )
        with self.assertRaises(ValidationError):
            duplicate.full_clean()
        with self.assertRaises(IntegrityError), transaction.atomic():
            duplicate.save()

    def test_same_year_for_different_members_and_multiple_years_are_allowed(self):
        self.create_history()
        self.create_history(year=2023)
        other = self.create_membership()
        self.create_history(membership=other)
        self.assertEqual(self.membership.annual_history.count(), 2)
        self.assertEqual(other.annual_history.count(), 1)

    def test_deleting_membership_cascades_only_its_history(self):
        history = self.create_history()
        other = self.create_membership()
        other_history = self.create_history(membership=other)
        self.membership.delete()
        self.assertFalse(MembershipAnnualHistory.objects.filter(pk=history.pk).exists())
        self.assertTrue(MembershipAnnualHistory.objects.filter(pk=other_history.pk).exists())
        self.assertTrue(Membership.objects.filter(pk=other.pk).exists())

    def test_membership_is_valid_without_history(self):
        self.membership.full_clean()
        self.membership.refresh_from_db()
        self.assertFalse(self.membership.annual_history.exists())

    def test_string_representation_never_loads_membership_pii(self):
        history = self.create_history()
        history = MembershipAnnualHistory.objects.get(pk=history.pk)
        with self.assertNumQueries(0), patch(
            "config.fields.decrypt_text", side_effect=AssertionError("Unexpected PII access"),
        ):
            self.assertEqual(str(history), f"Membership {self.membership.pk} - 2022 - active")
            history.is_active = False
            self.assertEqual(str(history), f"Membership {self.membership.pk} - 2022 - inactive")

    def test_history_changes_do_not_modify_membership_or_payment_facts(self):
        self.membership = self.create_membership(
            checkout_reference="MEM-" + "a" * 32,
            stripe_payment_intent_id="pi_test_annual_history",
        )
        before = Membership.objects.values().get(pk=self.membership.pk)
        membership_count = Membership.objects.count()
        history = self.create_history()
        history.is_active = False
        history.save()
        history.delete()
        self.assertEqual(Membership.objects.values().get(pk=self.membership.pk), before)
        self.assertEqual(Membership.objects.count(), membership_count)

    def test_schema_contains_only_annual_membership_facts(self):
        self.assertEqual(
            {field.name for field in MembershipAnnualHistory._meta.fields},
            {"membership_annual_history_id", "membership", "year", "is_active"},
        )
