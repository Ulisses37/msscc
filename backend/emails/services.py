import logging

import resend
from django.conf import settings
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, template_name: str, context: dict) -> None:
    """Render an email template and send it via the configured provider.

    This is the single public entry point for transactional emails. It renders
    ``template_name`` with ``context`` to produce the HTML body, then hands the
    payload to the internal provider function. Callers (e.g. ``messages.py``)
    never touch the provider directly, so the underlying provider can be swapped
    or given a fallback without changing any calling code.

    Existing behavior is preserved: failures are logged and a dev alert is sent
    when ``RESEND_DEV_ALERT_EMAIL`` is configured.
    """
    html = render_to_string(template_name, context)
    from_email = settings.RESEND_FROM_EMAIL

    try:
        _send_via_resend(from_email, to_email=to, subject=subject, html=html)
    except Exception as exc:
        logger.error("Resend send failed for %s: %s", to, exc)
        if not settings.RESEND_DEV_ALERT_EMAIL:
            return
        _send_dev_alert(from_email, to, subject, str(exc))


def _send_via_resend(from_email: str, to_email: str, subject: str, html: str) -> None:
    """Send an email through Resend.

    This internal function is the only place the Resend SDK is invoked. All
    provider selection, swapping, or fallback logic belongs here — never call
    ``resend.Emails.send`` from anywhere else.
    """
    resend.api_key = settings.RESEND_API_KEY
    resend.Emails.send(
        {
            "from": from_email,
            "to": to_email,
            "subject": subject,
            "html": html,
        }
    )


def _send_dev_alert(from_email: str, to_email: str, original_subject: str, error_message: str) -> None:
    """Send a dev-alert email notifying about a failed send.

    Best-effort: failures here are logged but never raised so they don't mask
    the original sending error.
    """
    alert_subject = f"[MSSCC dev] Email failed: {original_subject}"
    alert_html = (
        f"<p>Failed to send email to: {to_email}</p>"
        f"<p>Subject: {original_subject}</p>"
        f"<p>Error: {error_message}</p>"
    )
    try:
        logger.info("Sending alert to: %s", settings.RESEND_DEV_ALERT_EMAIL)
        _send_via_resend(from_email, to_email=settings.RESEND_DEV_ALERT_EMAIL, subject=alert_subject, html=alert_html)
    except Exception as alert_exc:
        logger.error("Resend alert send also failed: %s", alert_exc)

