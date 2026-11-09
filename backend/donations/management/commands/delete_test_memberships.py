from django.core.management.base import BaseCommand

from donations.models import Membership

# Every reference the test-data command writes starts with this prefix, which is
# what makes cleanup safe: only rows this tooling created are ever matched.
TEST_REFERENCE_PREFIX = "MEM-TEST-"


def test_memberships():
    """Return only the memberships created by create_test_membership."""
    return Membership.objects.filter(reference_id__startswith=TEST_REFERENCE_PREFIX)


class Command(BaseCommand):
    """Delete the test memberships created by ``create_test_membership``.

    Matches on the ``MEM-TEST-`` reference prefix, so a membership entered
    through the admin or imported from CSV is never matched even when it shares
    the test address. Run ``--dry-run`` first to see what would go.

    Development convenience only. It deletes from whatever database the settings
    point at, so do not run it against production.
    """

    help = (
        "Delete memberships created by create_test_membership, so the reminder "
        "test data can be cleaned up."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List the memberships that would be deleted, and delete nothing.",
        )
        parser.add_argument(
            "--email",
            default=None,
            help=(
                "Only delete test memberships with this address. Omit to delete "
                "every membership created by create_test_membership."
            ),
        )

    def handle(self, *args, **options):
        matches = test_memberships()
        email = options["email"]
        if email:
            # The address is ciphertext, so it cannot be filtered in SQL.
            matches = matches.only("email_encrypted", "reference_id")
            matched_ids = [m.pk for m in matches if m.email_encrypted == email]
            matches = Membership.objects.filter(pk__in=matched_ids)

        rows = list(matches.only("membership_id", "end_date", "reference_id"))
        if not rows:
            self.stdout.write("No test memberships found. Nothing to delete.")
            return

        for membership in rows:
            self.stdout.write(
                f"  membership {membership.membership_id} "
                f"(expires {membership.end_date}, {membership.reference_id})"
            )

        if options["dry_run"]:
            self.stdout.write(
                self.style.WARNING(
                    f"Dry run: {len(rows)} test membership(s) would be deleted."
                )
            )
            return

        Membership.objects.filter(
            pk__in=[membership.pk for membership in rows]
        ).delete()
        self.stdout.write(
            self.style.SUCCESS(f"Deleted {len(rows)} test membership(s).")
        )
