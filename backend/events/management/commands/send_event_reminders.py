from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from emails.messages import send_event_reminder_email
from events.models import Event


class Command(BaseCommand):
    """Send reminder emails to volunteers for eligible upcoming events.

    Reminders are sent per-event rather than per-signup: for every event with
    reminders enabled (``send_volunteer_reminders``), that has not yet had its
    batch sent (``reminder_sent_at`` is null), and whose start time falls within
    the reminder window, we collect each signup's email from all of the event's
    slots, deduplicate by email (a volunteer covering multiple slots still gets
    one reminder), send one email per unique address, and then stamp
    ``reminder_sent_at`` on the event so it is not re-sent.
    """

    help = (
        "Send reminder emails to volunteers for events starting within the "
        "reminder window, and mark each event as reminded."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--hours-before",
            type=int,
            default=24,
            help=(
                "Send reminders for events starting within this many hours from "
                "now (default: 24)."
            ),
        )

    def handle(self, *args, **options):
        hours_before = options["hours_before"]
        now = timezone.now()

        candidate_events = Event.objects.filter(
            send_volunteer_reminders=True,
            reminder_sent_at__isnull=True,
            start_datetime__lte=now + timedelta(hours=hours_before),
            start_datetime__gte=now,
        )

        self.stdout.write(
            self.style.HTTP_INFO(
                f"Found {candidate_events.count()} event(s) in the reminder window."
            )
        )

        for event in candidate_events:
            self._send_reminder_for_event(event, now)

    def _send_reminder_for_event(self, event, now):
        """Collect, deduplicate, and send reminder emails for a single event."""
        # Collect recipient emails across all the event's slots. A volunteer
        # covering multiple slots on the same event should still receive one
        # reminder, so we key the map by email address.
        recipients = {}
        for slot in event.slots.all():
            for signup in slot.signup.all():
                email = signup.email.strip().lower()
                if email and email not in recipients:
                    recipients[email] = signup.first_name

        self.stdout.write(
            f"  Event '{event.title_en}' → {len(recipients)} unique recipient(s)."
        )

        for email, first_name in recipients.items():
            send_event_reminder_email(
                to_email=email,
                event=event,
                first_name=first_name,
            )
            self.stdout.write(f"    Sent reminder to {email}.")

        event.reminder_sent_at = now
        event.save(update_fields=["reminder_sent_at"])

        self.stdout.write(
            self.style.SUCCESS(
                f"  Marked event '{event.title_en}' as reminded."
            )
        )
