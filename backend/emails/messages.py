from emails.services import send_email


def send_password_reset_email(to_email: str, reset_link: str) -> None:
    """Send a password reset email through the shared email service."""
    send_email(
        to=to_email,
        subject="MSSCC Admin Password Reset",
        template_name="emails/password_reset.html",
        context={"reset_link": reset_link},
    )

