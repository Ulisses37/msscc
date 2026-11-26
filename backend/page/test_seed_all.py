from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from board_members.models import BoardMember
from content.models import Content
from media.models import MediaAsset, StaticImage
from page.management.commands.seed_all import SEED_COMMANDS
from page.models import Page
from page.page_content_import import ParsedContentBlock
from partners.models import Partner

COMMAND_MODULE = "page.management.commands.seed_all"
CONTENT_MODULE = "page.management.commands.populate_page_content"


class SeedAllCommandTests(TestCase):
    """Verify batch ordering, plan-only previews, and failure isolation."""

    def test_runs_only_approved_commands_in_dependency_order(self) -> None:
        output, errors = StringIO(), StringIO()
        with patch(f"{COMMAND_MODULE}.call_command") as child:
            call_command("seed_all", stdout=output, stderr=errors, verbosity=2, no_color=True)

        self.assertEqual(
            SEED_COMMANDS,
            (
                "seed_pages",
                "seed_static_media",
                "seed_board_members",
                "seed_partners",
                "populate_page_content",
            ),
        )
        self.assertEqual([args.args[0] for args in child.call_args_list], list(SEED_COMMANDS))
        for invocation in child.call_args_list:
            self.assertIs(invocation.kwargs["stdout"]._out, output)
            self.assertIs(invocation.kwargs["stderr"]._out, errors)
            self.assertEqual(invocation.kwargs["verbosity"], 2)
            self.assertTrue(invocation.kwargs["no_color"])
        self.assertIn("All 5 seed commands completed.", output.getvalue())

    def test_dry_run_lists_commands_without_executing_or_accessing_database(self) -> None:
        output = StringIO()
        with patch(f"{COMMAND_MODULE}.call_command") as child, self.assertNumQueries(0):
            call_command("seed_all", "--dry-run", stdout=output)

        child.assert_not_called()
        planned = [line for line in output.getvalue().splitlines() if line.startswith("Would run:")]
        self.assertEqual(planned, [f"Would run: {name}" for name in SEED_COMMANDS])
        self.assertIn("no source assets or data validated", output.getvalue())

    def test_failures_do_not_prevent_later_commands_and_result_in_command_error(self) -> None:
        output, errors = StringIO(), StringIO()
        with (
            patch(
                f"{COMMAND_MODULE}.call_command",
                side_effect=[
                    None,
                    CommandError("Asset unavailable"),
                    RuntimeError("Unexpected"),
                    None,
                    None,
                ],
            ) as child,
            self.assertLogs(COMMAND_MODULE, level="ERROR") as logs,
        ):
            with self.assertRaisesMessage(CommandError, "2 failed command(s)"):
                call_command("seed_all", stdout=output, stderr=errors)

        self.assertEqual(child.call_count, 5)
        self.assertEqual(len(logs.records), 2)
        self.assertIn("FAILED: seed_static_media", output.getvalue())
        self.assertIn("FAILED: seed_board_members", output.getvalue())
        self.assertIn("SUCCESS: populate_page_content", output.getvalue())
        self.assertNotIn("Unexpected", errors.getvalue())

    def test_process_interrupt_is_not_swallowed(self) -> None:
        with patch(f"{COMMAND_MODULE}.call_command", side_effect=KeyboardInterrupt) as child:
            with self.assertRaises(KeyboardInterrupt):
                call_command("seed_all", stdout=StringIO())
        self.assertEqual(child.call_count, 1)


class SeedAllExistingDataTests(TestCase):
    """Exercise real child commands against isolated data without storage uploads."""

    def test_individually_seeded_data_and_repeated_batches_are_preserved(self) -> None:
        # Existing linked slots avoid all static-media uploads. No file is created.
        asset = MediaAsset.objects.create(
            file="public/existing.png",
            file_name="existing.png",
            file_type="image/png",
            file_size=1,
        )
        for slot_id in range(3):
            StaticImage.objects.create(
                static_image_id=slot_id, display_name=f"Existing {slot_id}", media_asset=asset
            )

        block = ParsedContentBlock(
            page_slug="home",
            content_type="paragraph",
            content_en="Existing imported text",
            import_key="scrum-845:pagecontent:batch-test",
        )
        with (
            patch(f"{CONTENT_MODULE}.parse_page_content_document", return_value=[block]),
            patch(f"{CONTENT_MODULE}.PAGE_CONTENT_JA", {block.import_key: "既存のテキスト"}),
            patch("media.management.commands.seed_static_media.persist_media_asset") as upload,
        ):
            for command in (
                "seed_pages", "seed_board_members", "seed_partners", "populate_page_content"
            ):
                call_command(command, stdout=StringIO())
            Page.objects.filter(page_slug="home").update(page_title_en="Edited home")
            Partner.objects.filter(display_name_en="Salad Cosmo").update(is_visible=False)
            Content.objects.filter(import_key=block.import_key).update(content_en="Edited text")
            models = (Page, StaticImage, MediaAsset, BoardMember, Partner, Content)
            before = {model: list(model.objects.order_by("pk").values()) for model in models}

            for _ in range(2):
                output = StringIO()
                call_command("seed_all", stdout=output, stderr=StringIO())
                self.assertIn("All 5 seed commands completed.", output.getvalue())
                for model in models:
                    self.assertEqual(list(model.objects.order_by("pk").values()), before[model])

            upload.assert_not_called()

    def test_individually_seeded_pages_do_not_block_missing_partner_and_board_data(self) -> None:
        call_command("seed_pages", stdout=StringIO())
        real_call_command = call_command

        def run_child(name: str, **options) -> None:
            if name not in ("seed_static_media", "populate_page_content"):
                real_call_command(name, **options)

        with patch(f"{COMMAND_MODULE}.call_command", side_effect=run_child) as child:
            call_command("seed_all", stdout=StringIO())

        self.assertEqual(Page.objects.count(), 6)
        self.assertEqual(Partner.objects.count(), 28)
        self.assertEqual(BoardMember.objects.count(), 12)
        self.assertEqual([entry.args[0] for entry in child.call_args_list], list(SEED_COMMANDS))

