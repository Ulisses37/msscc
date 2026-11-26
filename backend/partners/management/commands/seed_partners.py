from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from partners.management.partner_seed_data import PARTNER_SEED_GROUPS
from partners.models import Partner


class Command(BaseCommand):
    """Create missing partner, donor, and sponsor acknowledgments."""

    help = "Seed partners, donors, and sponsors without overwriting existing records."

    def add_arguments(self, parser) -> None:
        """Register the read-only preview option."""
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Validate and preview missing records without writing to the database.",
        )

    @transaction.atomic
    def handle(self, *args, **options) -> None:
        """Validate and create missing acknowledgments in their supplied order."""
        dry_run = options["dry_run"]
        created_count = 0
        existing_count = 0

        for category_en, category_ja, seeds in PARTNER_SEED_GROUPS:
            for display_order, seed in enumerate(seeds):
                # Accept the plural category labels already supported by the public page.
                if Partner.objects.filter(
                    display_name_en__iexact=seed.display_name_en,
                    category_en__iregex=rf"^{category_en}s?$",
                ).exists():
                    existing_count += 1
                    self.stdout.write(
                        f"Already exists: {seed.display_name_en} ({category_en})"
                    )
                    continue

                partner = Partner(
                    display_name_en=seed.display_name_en,
                    display_name_ja="",
                    category_en=category_en,
                    category_ja=category_ja,
                    website_url=seed.website_url,
                    # The legacy model requires an amount, but none was supplied.
                    contribution_amount=Decimal("0.00"),
                    is_visible=True,
                    media_is_visible=False,
                    display_order=display_order,
                    media_asset=None,
                )
                partner.full_clean()
                if not dry_run:
                    partner.save()
                created_count += 1
                action = "Would create" if dry_run else "Created"
                self.stdout.write(f"{action}: {seed.display_name_en} ({category_en})")

        label = "Partner dry run complete" if dry_run else "Partner seed complete"
        count_label = "Would create" if dry_run else "Created"
        self.stdout.write(
            self.style.SUCCESS(
                f"{label}. {count_label}: {created_count}; existing: {existing_count}."
            )
        )
