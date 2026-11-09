from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from donations.models import Membership


class Command(BaseCommand):
    """Create one membership that expires inside the reminder window.

    Adds test data so the reminder can be exercised end to end without waiting
    for a real membership to come due. The row is built to pass every selector
    condition: an ``active`` status, a usable address, an expiry inside the
    window, and no previous reminder for that date.

    Development convenience only. It writes to whatever database the settings
    point at, so do not run it against production.
    """

    help = (
        "Create a test membership expiring in N days so the expiry reminder can "
        "be triggered locally."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            default="test-member@example.test",
            help="Address for the test member (default: test-member@example.test).",
        )
        parser.add_argument(
            "--days",
            type=int,
            default=10,
            help="Days until the membership expires (default: 10).",
        )
        parser.add_argument(
            "--first-name",
            default="Test",
            help="Given name used in the email greeting (default: Test).",
        )
        parser.add_argument(
            "--type",
            dest="membership_type",
            default="individual",
            help="membership_type value to store (default: individual).",
        )

    def handle(self, *args, **options):
        expiry = timezone.localdate() + timedelta(days=options["days"])

        membership = Membership.objects.create(
            first_name_encrypted=options["first_name"],
            last_name_encrypted="Member",
            email_encrypted=options["email"],
            membership_type=options["membership_type"],
            # "active" and a real address are what make the row selectable; a
            # cancelled or pending status would be filtered out on purpose.
            status="active",
            payment_status=Membership.PaymentStatus.COMPLETED,
            start_date=expiry - timedelta(days=365),
            end_date=expiry,
            renewal_date=expiry + timedelta(days=1),
            membership_price="35.00",
            amount_paid="35.00",
            reference_id=f"MEM-TEST-{timezone.now():%Y%m%d%H%M%S}",
            notes="Test member created for the expiry reminder.",
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Created membership {membership.membership_id} "
                f"({options['email']}) expiring {expiry:%Y-%m-%d}, "
                f"{options['days']} day(s) from now."
            )
        )
        self.stdout.write("Run the reminder with:")
        self.stdout.write(
            "  backend\\venv\\Scripts\\python.exe backend/manage.py "
            "send_membership_expiry_reminders --dry-run"
        )
        self.stdout.write(
            "  backend\\venv\\Scripts\\python.exe backend/manage.py "
            "send_membership_expiry_reminders"
        )
