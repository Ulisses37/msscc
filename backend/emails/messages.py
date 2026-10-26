from django.conf import settings

from emails.services import send_email


def send_password_reset_email(to_email: str, reset_link: str) -> None:
    """Send a password reset email through the shared email service."""
    send_email(
        to=to_email,
        subject="MSSCC Admin Password Reset",
        template_name="emails/password_reset.html",
        context={"reset_link": reset_link},
    )


def send_volunteer_thanks_email(signup) -> None:
    """Send a volunteer signup confirmation email.

    Builds the email context from the signup's related slot and event, then
    renders ``emails/volunteer_thanks.html`` through the shared email service.
    If the signup has no associated slot, there is no event/role to confirm,
    so no email is sent.
    """
    if signup.slot is None:
        return

    signup_details = {
        "first_name": signup.first_name,
        "event_name": signup.slot.event.title_en,
        "start_datetime": signup.slot.start_datetime.strftime("%B %d, %Y at %I:%M %p"),
        "role": signup.slot.position_name,
        "cancellation_url": (
            f"{settings.FRONTEND_URL.rstrip('/')}/en/volunteer/cancel/{signup.cancellation_token}"
        ),
    }

    send_email(
        to=signup.email,
        subject="MSSCC Volunteer Signup Confirmation",
        template_name="emails/volunteer_thanks.html",
        context=signup_details,
    )


def send_event_reminder_email(to_email: str, event, first_name: str = "") -> None:
    """Send a volunteer event reminder email to a single recipient.

    Unlike the signup-confirmation email, this is sent per-event after the
    volunteer emails have been deduplicated (see the ``send_event_reminders``
    management command), so it takes a single recipient email and the event as
    context rather than a specific signup. ``first_name`` is optional and used
    only to personalize the greeting when it is known.
    """
    reminder_details = {
        "first_name": first_name,
        "event_name": event.title_en,
        "start_datetime": event.start_datetime.strftime("%B %d, %Y at %I:%M %p"),
        "location": event.location_en or "TBD",
    }

    send_email(
        to=to_email,
        subject=f"MSSCC Event Reminder: {event.title_en}",
        template_name="emails/event_reminder.html",
        context=reminder_details,
    )


def format_event_datetime(value) -> str:
    """Render a datetime the way the volunteer emails display it."""
    if value is None:
        return "To be announced"
    return value.strftime("%B %d, %Y at %I:%M %p")


def send_volunteer_shift_removed_email(to_email: str, details: dict) -> None:
    """Tell a volunteer that a shift they signed up for was removed."""
    send_email(
        to=to_email,
        subject=f"MSSCC Shift Cancelled: {details['event_name']}",
        template_name="emails/volunteer_shift_removed.html",
        context={
            "first_name": details.get("first_name", ""),
            "event_name": details["event_name"],
            "role": details.get("role") or "Volunteer",
            "removed_datetime": (
                f"{format_event_datetime(details.get('start_datetime'))} - "
                f"{format_event_datetime(details.get('end_datetime'))}"
            ),
        },
    )


def send_volunteer_shift_moved_email(
    to_email: str,
    details: dict,
    role_changed_from: str | None = None,
) -> None:
    """Tell a volunteer that the date, time or location of a shift changed.

    ``role_changed_from`` is set when the same save also changed the role, so the
    volunteer learns about both in the one email the story asks for. The rename
    is only applied in the body; the caller keeps passing ``new_role``.
    """
    new_role = details.get("new_role") or details.get("role") or "Volunteer"

    send_email(
        to=to_email,
        subject=f"MSSCC Shift Changed: {details['event_name']}",
        template_name="emails/volunteer_shift_moved.html",
        context={
            "first_name": details.get("first_name", ""),
            "event_name": details["event_name"],
            "role": new_role,
            "role_changed_from": role_changed_from or "",
            "new_datetime": (
                f"{format_event_datetime(details.get('new_start_datetime'))} - "
                f"{format_event_datetime(details.get('new_end_datetime'))}"
            ),
            "new_location": details.get("new_location") or "To be announced",
        },
    )


def send_volunteer_role_changed_email(to_email: str, details: dict) -> None:
    """Tell a volunteer that the role for a shift they hold has changed."""
    send_email(
        to=to_email,
        subject=f"MSSCC Role Changed: {details['event_name']}",
        template_name="emails/volunteer_role_changed.html",
        context={
            "first_name": details.get("first_name", ""),
            "event_name": details["event_name"],
            "old_role": details.get("old_role") or "",
            "new_role": details.get("new_role") or "Volunteer",
            "location": details.get("new_location") or details.get("location") or "To be announced",
        },
    )


