"""Initialize placeholder BoardMember records for a preproduction website."""

from dataclasses import replace

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Max

from board_members.management.board_member_seed_data import (
    INITIAL_BOARD_MEMBER_SEEDS,
    PLACEHOLDER_START_DATE,
    REFILL_OFFICER_SEED,
    BoardMemberSeed,
)
from board_members.models import BoardMember
from media.models import StaticImage

MINIMUM_BOARD_MEMBER_COUNT = 4


class Command(BaseCommand):
    """Create the initial board template or refill missing officer capacity."""

    help = "Seed the preproduction Board of Directors template."

    def add_arguments(self, parser) -> None:
        """Register validation-only mode."""
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report planned records without writing to the database.",
        )

    def handle(self, *args, **options) -> None:
        """Create only the placeholder records required by the initialization rules."""
        existing_count = BoardMember.objects.count()
        seeds = self._get_seeds(existing_count)
        placeholder_media_asset_id = self._get_placeholder_media_asset_id()

        if options["dry_run"]:
            self._dry_run(existing_count, seeds, placeholder_media_asset_id)
            return

        self._seed(existing_count, seeds, placeholder_media_asset_id)

    def _get_seeds(self, existing_count: int) -> tuple[BoardMemberSeed, ...]:
        """Return the initial template or count-based officer refill records."""
        if existing_count == 0:
            return INITIAL_BOARD_MEMBER_SEEDS

        missing_count = max(0, MINIMUM_BOARD_MEMBER_COUNT - existing_count)
        if missing_count == 0:
            return ()

        next_display_order = (
            BoardMember.objects.aggregate(max_order=Max("display_order"))["max_order"]
            or 0
        ) + 1
        return tuple(
            replace(
                REFILL_OFFICER_SEED,
                display_order=next_display_order + index,
            )
            for index in range(missing_count)
        )

    def _get_placeholder_media_asset_id(self) -> int | None:
        """Return StaticImage ID 0's media asset, if that placeholder is available."""
        return StaticImage.objects.filter(static_image_id=0).values_list(
            "media_asset_id",
            flat=True,
        ).first()

    def _dry_run(
        self,
        existing_count: int,
        seeds: tuple[BoardMemberSeed, ...],
        placeholder_media_asset_id: int | None,
    ) -> None:
        """Describe planned records without changing database state."""
        for seed in seeds:
            media_status = (
                f"media asset {placeholder_media_asset_id}"
                if placeholder_media_asset_id is not None
                else "no media asset"
            )
            self.stdout.write(
                f"Would create board member: {seed.display_name_en} "
                f"({seed.role_en}; {media_status})"
            )

        self.stdout.write(
            self.style.SUCCESS(
                "Board member dry run complete. "
                f"Existing: {existing_count}; would create: {len(seeds)}."
            )
        )

    def _seed(
        self,
        existing_count: int,
        seeds: tuple[BoardMemberSeed, ...],
        placeholder_media_asset_id: int | None,
    ) -> None:
        """Persist only the planned placeholder records in one transaction."""
        with transaction.atomic():
            for seed in seeds:
                BoardMember.objects.create(
                    display_name_en=seed.display_name_en,
                    display_name_ja="",
                    display_order=seed.display_order,
                    external_link=None,
                    media_asset_id=placeholder_media_asset_id,
                    role_en=seed.role_en,
                    role_ja="",
                    start_date=PLACEHOLDER_START_DATE,
                    caption_en="",
                    caption_ja="",
                )
                self.stdout.write(
                    f"Created board member: {seed.display_name_en} ({seed.role_en})"
                )

        self.stdout.write(
            self.style.SUCCESS(
                "Board member seed complete. "
                f"Created: {len(seeds)}; existing: {existing_count}."
            )
        )
