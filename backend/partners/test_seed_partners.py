from decimal import Decimal
from io import StringIO
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.test import TestCase

from partners.management.partner_seed_data import PARTNER_SEED_GROUPS
from partners.models import Partner


class SeedPartnersCommandTests(TestCase):
    """Verify acknowledgment seeding without media uploads or existing-data changes."""

    def run_command(self, *args: str) -> str:
        """Run the seed command and capture its output."""
        output = StringIO()
        call_command("seed_partners", *args, stdout=output)
        return output.getvalue()

    def test_empty_database_creates_all_categories_in_supplied_order(self) -> None:
        output = self.run_command()

        self.assertEqual(Partner.objects.count(), 28)
        for category, expected_count in (("Partner", 14), ("Donor", 9), ("Sponsor", 5)):
            self.assertEqual(Partner.objects.filter(category_en=category).count(), expected_count)
        for category_en, category_ja, seeds in PARTNER_SEED_GROUPS:
            records = list(Partner.objects.filter(category_en=category_en))
            self.assertEqual(
                [record.display_name_en for record in records],
                [seed.display_name_en for seed in seeds],
            )
            self.assertEqual(
                [record.website_url for record in records],
                [seed.website_url for seed in seeds],
            )
            self.assertEqual(
                [record.display_order for record in records], list(range(len(seeds)))
            )
            for record in records:
                record.full_clean()
                self.assertEqual(record.category_ja, category_ja)
                self.assertEqual(record.display_name_ja, "")
                self.assertEqual(record.contribution_amount, Decimal("0.00"))
                self.assertTrue(record.is_visible)
                self.assertFalse(record.media_is_visible)
                self.assertIsNone(record.media_asset_id)
        self.assertIn("Created: 28; existing: 0.", output)

    def test_source_names_are_corrected_and_schools_and_hanami_are_separate(self) -> None:
        self.run_command()

        for name in (
            "Salad Cosmo",
            "Fusako and Henry Mizushima",
            "Orchard Elementary School",
            "Matsuyama Elementary School",
            "C.K. McClatchy High School",
            "Rosemont High School",
        ):
            self.assertTrue(Partner.objects.filter(display_name_en=name).exists())
        self.assertEqual(
            Partner.objects.get(display_name_en="Sacramento Tree Foundation").website_url,
            "https://sactree.org",
        )
        self.assertEqual(
            Partner.objects.get(display_name_en="Hanami Line").website_url,
            "https://sactree.org/hanami/",
        )

    def test_repeated_execution_preserves_every_record(self) -> None:
        self.run_command()
        before = list(Partner.objects.values())

        output = self.run_command()

        self.assertEqual(list(Partner.objects.values()), before)
        self.assertIn("Created: 0; existing: 28.", output)

    def test_partially_seeded_database_preserves_existing_edits_and_unrelated_records(self) -> None:
        existing = Partner.objects.create(
            display_name_en="CITY OF SACRAMENTO",
            display_name_ja="サクラメント市",
            category_en="partners",
            category_ja="既存",
            website_url="https://example.org/custom",
            contribution_amount=Decimal("125.00"),
            display_order=80,
            is_visible=False,
            media_is_visible=True,
        )
        unrelated = Partner.objects.create(
            display_name_en="Unrelated organization",
            category_en="Sponsor",
            contribution_amount=Decimal("50.00"),
        )
        before = list(Partner.objects.values())

        output = self.run_command()

        self.assertEqual(Partner.objects.count(), 29)
        self.assertEqual(
            list(Partner.objects.filter(pk__in=[existing.pk, unrelated.pk]).values()), before
        )
        self.assertIn("Created: 27; existing: 1.", output)

    def test_same_name_in_another_category_does_not_prevent_creation(self) -> None:
        Partner.objects.create(
            display_name_en="Salad Cosmo",
            category_en="Donor",
            contribution_amount=Decimal("25.00"),
        )

        self.run_command()

        self.assertEqual(Partner.objects.filter(display_name_en="Salad Cosmo").count(), 2)

    def test_dry_run_does_not_write_records(self) -> None:
        output = self.run_command("--dry-run")

        self.assertFalse(Partner.objects.exists())
        self.assertIn("Would create: 28; existing: 0.", output)

    def test_dry_run_skips_existing_records_without_changes(self) -> None:
        self.run_command()
        before = list(Partner.objects.values())

        output = self.run_command("--dry-run")

        self.assertEqual(list(Partner.objects.values()), before)
        self.assertIn("Would create: 0; existing: 28.", output)

    def test_validation_failure_rolls_back_preceding_creates(self) -> None:
        original_full_clean = Partner.full_clean

        def validate(partner: Partner) -> None:
            if partner.display_name_en == "Sacramento Buddhist Church":
                raise ValidationError("Invalid seed record.")
            original_full_clean(partner)

        with patch.object(Partner, "full_clean", validate):
            with self.assertRaises(ValidationError):
                self.run_command()

        self.assertFalse(Partner.objects.exists())
