from django.core.management.base import BaseCommand

from donations.membership_reminders import run_membership_expiry_reminders


class Command(BaseCommand):
    """Send membership expiry reminders to members whose term is ending.

    The same run logic backs the protected trigger endpoint, so this command and
    the endpoint can never disagree about who is reminded. Delivery is at most
    once per expiry: the expiry is claimed before the send, so overlapping runs
    cannot both mail one member, and a crash between the claim and the send skips
    that member until the next cycle.
    """

    help = (
        "Email members whose membership expires within the reminder window, "
        "skipping anyone already reminded for that expiry date."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--days-before",
            type=int,
            default=14,
            help="Remind members expiring within this many days (default: 14).",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=50,
            help=(
                "Maximum reminders to attempt in this run (default: 50). Keeps a "
                "run short and under the daily provider send cap."
            ),
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help=(
                "Report who would be reminded without claiming or sending "
                "anything. Ignores the feature flag so the list can be reviewed "
                "before it is switched on."
            ),
        )

    def handle(self, *args, **options):
        tally = run_membership_expiry_reminders(
            days=options["days_before"],
            limit=options["limit"],
            dry_run=options["dry_run"],
        )

        if tally.disabled:
            self.stdout.write(
                self.style.WARNING(
                    "Membership reminders are disabled "
                    "(MEMBERSHIP_REMINDERS_ENABLED is off). Nothing was sent."
                )
            )
            return

        if options["dry_run"]:
            # Primary keys only: a preview must never print an address.
            self.stdout.write(
                self.style.HTTP_INFO(
                    f"Dry run: {len(tally.would_remind)} member(s) would be reminded "
                    f"within {options['days_before']} day(s)."
                )
            )
            for pk in tally.would_remind:
                self.stdout.write(f"  would remind membership {pk}.")
            self.stdout.write(f"  skipped (no usable address): {tally.skipped}.")
            if tally.limit_reached:
                self.stdout.write(
                    f"  more eligible members remained beyond the limit "
                    f"of {tally.limit}."
                )
            self.stdout.write("Dry run sent nothing and marked nothing.")
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Membership reminders: sent {tally.sent}, "
                f"failed {tally.failed}, skipped {tally.skipped}."
            )
        )
        if tally.limit_reached:
            self.stdout.write(
                self.style.WARNING(
                    f"Reached the limit of {tally.limit}; more eligible members remain."
                )
            )
        if tally.aborted:
            self.stdout.write(
                self.style.ERROR(
                    "Run aborted early after repeated provider failures. "
                    "Claims were released; the next run will retry."
                )
            )
