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
    }

    send_email(
        to=signup.email,
        subject="MSSCC Volunteer Signup Confirmation",
        template_name="emails/volunteer_thanks.html",
        context=signup_details,
    )

