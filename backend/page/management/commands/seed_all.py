import logging

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

logger = logging.getLogger(__name__)

SEED_COMMANDS = (
    "seed_pages",
    "seed_static_media",
    "seed_board_members",
    "seed_partners",
    "populate_page_content",
)


class Command(BaseCommand):
    """Run the website initialization commands in dependency order."""

    help = "Run all website seed commands, preserving each command's existing-data behavior."

    def add_arguments(self, parser) -> None:
        """Register a plan-only preview that never executes child commands."""
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List commands in execution order without executing or validating them.",
        )

    def handle(self, *args, **options) -> None:
        """Attempt every seed and report failures without undoing completed commands."""
        if options["dry_run"]:
            for command_name in SEED_COMMANDS:
                self.stdout.write(f"Would run: {command_name}")
            self.stdout.write(
                "Plan only: no commands executed and no source assets or data validated."
            )
            return

        results = []
        # Do not wrap the batch in a transaction: storage writes cannot be rolled back,
        # and each child owns its transaction and repeat-run behavior.
        for command_name in SEED_COMMANDS:
            self.stdout.write(f"Running: {command_name}")
            try:
                call_command(
                    command_name,
                    stdout=self.stdout,
                    stderr=self.stderr,
                    verbosity=options["verbosity"],
                    no_color=options["no_color"],
                    force_color=options["force_color"],
                )
            except Exception:
                # This batch boundary isolates even unexpected child failures so later
                # independent seeds can run. Never intercept process interrupts/exits.
                logger.exception("Seed command failed: %s", command_name)
                self.stderr.write(
                    self.style.ERROR(f"Failed: {command_name}. See logs for details.")
                )
                results.append((command_name, False))
            else:
                results.append((command_name, True))

        self.stdout.write("Seed summary:")
        for command_name, succeeded in results:
            status = "SUCCESS" if succeeded else "FAILED"
            self.stdout.write(f"{status}: {command_name}")

        failures = [name for name, succeeded in results if not succeeded]
        if failures:
            raise CommandError(
                f"Seed batch finished with {len(failures)} failed command(s): "
                f"{', '.join(failures)}. Completed commands were not rolled back."
            )
        self.stdout.write(self.style.SUCCESS(f"All {len(results)} seed commands completed."))
