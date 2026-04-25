import resend
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

def send_password_reset_email(to_email: str, reset_link: str) -> None:
    """Send a password reset email via Resend. Logs and alerts on failure."""
    resend.api_key = settings.RESEND_API_KEY

    try:
        resend.Emails.send({
            "from": settings.RESEND_FROM_EMAIL,
            "to": to_email,
            "subject": "MSSCC Admin Password Reset",
            "html": (
                f"<p>You requested a password reset for your MSSCC admin account.</p>"
                f"<p>Click the link below to set a new password. This link expires in 1 hour.</p>"
                f'<p><a href="{reset_link}">Reset your password</a></p>'
                f"<p>If you didn't request this, you can ignore this email.</p>"
            ),
        })
    except Exception as exc:
        logger.error("Resend send failed for %s: %s", to_email, exc)
        if not settings.RESEND_DEV_ALERT_EMAIL:
            return
        error_message = str(exc)
        try:
            logger.info("Sending alert to: %s", settings.RESEND_DEV_ALERT_EMAIL)
            resend.Emails.send({
                "from": settings.RESEND_FROM_EMAIL,
                "to": settings.RESEND_DEV_ALERT_EMAIL,
                "subject": "[MSSCC dev] Password reset email failed",
                "html": (
                    f"<p>Failed to send password reset to: {to_email}</p>"
                    f"<p>Error: {error_message}</p>"
                    f"<p>Reset link was: {reset_link}</p>"
                ),
            })
        except Exception as alert_exc:
            logger.error("Resend alert send also failed: %s", alert_exc)
