from io import StringIO

from django.core.files.base import ContentFile
from django.core.management import call_command
from django.test import TestCase, override_settings

from board_members.models import BoardMember
from media.models import MediaAsset, StaticImage

TEST_STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.InMemoryStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}


@override_settings(STORAGES=TEST_STORAGES)
class SeedBoardMembersCommandTests(TestCase):
    """Verify preproduction board initialization and count-based refilling."""

    def run_command(self, *args: str) -> str:
        """Run the seed command and return its console output."""
        output = StringIO()
        call_command("seed_board_members", *args, stdout=output)
        return output.getvalue()

    def test_empty_database_creates_four_officers_and_eight_directors(self) -> None:
        output = self.run_command()

        members = list(
            BoardMember.objects.order_by("display_order").values(
                "display_name_en",
                "role_en",
                "display_order",
                "start_date",
                "media_asset_id",
            )
        )
        self.assertEqual(BoardMember.objects.count(), 12)
        self.assertEqual(
            [member["role_en"] for member in members],
            [
                "President",
                "Vice President",
                "Secretary",
                "Treasurer",
                *(["Director"] * 8),
            ],
        )
        self.assertEqual([member["display_order"] for member in members], list(range(12)))
        self.assertTrue(all(member["start_date"].isoformat() == "2000-01-01" for member in members))
        self.assertTrue(all(member["media_asset_id"] is None for member in members))
        self.assertIn("Created: 12; existing: 0.", output)

    def test_repeated_execution_does_not_duplicate_records(self) -> None:
        self.run_command()
        output = self.run_command()

        self.assertEqual(BoardMember.objects.count(), 12)
        self.assertIn("Created: 0; existing: 12.", output)

    def test_nonempty_table_refills_only_to_four_without_matching_roles(self) -> None:
        BoardMember.objects.create(
            display_name_en="Existing Person",
            role_en="Unrelated Role A",
            start_date="2026-01-01",
        )
        BoardMember.objects.create(
            display_name_en="Existing Person Two",
            role_en="Unrelated Role B",
            start_date="2026-01-01",
        )

        output = self.run_command()

        self.assertEqual(BoardMember.objects.count(), 4)
        self.assertEqual(
            list(
                BoardMember.objects.order_by("board_member_id").values_list(
                    "display_name_en", "role_en"
                )
            ),
            [
                ("Existing Person", "Unrelated Role A"),
                ("Existing Person Two", "Unrelated Role B"),
                ("Officer Placeholder", "Officer"),
                ("Officer Placeholder", "Officer"),
            ],
        )
        self.assertIn("Created: 2; existing: 2.", output)

    def test_nonempty_table_with_four_arbitrary_roles_is_not_refilled(self) -> None:
        for index in range(4):
            BoardMember.objects.create(
                display_name_en=f"Existing Person {index}",
                role_en=f"Custom Role {index}",
                start_date="2026-01-01",
            )

        output = self.run_command()

        self.assertEqual(BoardMember.objects.count(), 4)
        self.assertIn("Created: 0; existing: 4.", output)

    def test_placeholder_media_is_reused_for_initial_records(self) -> None:
        placeholder_asset = MediaAsset.objects.create(
            file=ContentFile(b"placeholder", name="placeholder.png"),
            file_name="placeholder.png",
            file_type="image/png",
            file_size=11,
        )
        StaticImage.objects.create(
            static_image_id=0,
            display_name="Placeholder",
            media_asset=placeholder_asset,
        )

        self.run_command()

        self.assertEqual(
            set(BoardMember.objects.values_list("media_asset_id", flat=True)),
            {placeholder_asset.pk},
        )

    def test_dry_run_does_not_write_records(self) -> None:
        output = self.run_command("--dry-run")

        self.assertEqual(BoardMember.objects.count(), 0)
        self.assertIn("Existing: 0; would create: 12.", output)
