import logging

from django.conf import settings
from django.template.loader import render_to_string

from emails.providers import get_provider

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

    # ── DEV-ONLY EMAIL INTERCEPTION LAYER ─────────────────────────────────
    # Resend no longer redirects test-mode emails to the account owner's
    # inbox; it hard-fails on unverified recipients instead. While in
    # development we route every outgoing email to the dev inbox
    # (RESEND_DEV_ALERT_EMAIL) so we can inspect it.
    # REMOVE THIS BLOCK BEFORE DEPLOY.
    if (
        settings.DEBUG
        and getattr(settings, "EMAIL_SEND_TO_DEV", False)
        and settings.RESEND_DEV_ALERT_EMAIL
    ):
        original_recipient = to
        to = settings.RESEND_DEV_ALERT_EMAIL
        subject = f"[DEV → {original_recipient}] {subject}"
        html = (
            '<div style="margin:0 0 16px;padding:12px 16px;border:1px solid #D3D1C7;'
            'background:#F1EFE8;font:13px/1.5 Almarai,sans-serif;color:#3D3D3A;">'
            f'<strong>DEV INTERCEPT</strong> — original recipient: {original_recipient}'
            f' · template: {template_name}</div>{html}'
        )
        logger.info(
            "DEV interception: redirecting email intended for %s to %s",
            original_recipient,
            to,
        )
    # ── END DEV-ONLY EMAIL INTERCEPTION LAYER ──────────────────────────────

    try:
        _send_via_provider(to_email=to, subject=subject, html=html)
    except Exception as exc:
        # Catch broadly on purpose: a provider outage, a misconfigured
        # EMAIL_PROVIDER, or an adapter construction failure must never
        # propagate into a password-reset or volunteer-signup caller.
        # ProviderError keeps its message generic; the underlying cause is what
        # gets logged and mailed to the dev inbox.
        cause = exc.__cause__ or exc
        logger.error("Email send failed for %s: %s", to, cause)
        if not settings.RESEND_DEV_ALERT_EMAIL:
            return
        _send_dev_alert(to, subject, str(cause))


def _send_via_provider(*, to_email: str, subject: str, html: str) -> None:
    """Send an email through the configured provider.

    All provider selection, swapping, or fallback logic belongs behind
    ``get_provider()`` — never call a provider SDK from anywhere else. The
    adapter reads the sender address from settings, so this stays provider
    agnostic.
    """
    get_provider().send_email(to=to_email, subject=subject, html=html)


def _send_dev_alert(
    to_email: str,
    original_subject: str,
    error_message: str,
) -> None:
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
        _send_via_provider(
            to_email=settings.RESEND_DEV_ALERT_EMAIL,
            subject=alert_subject,
            html=alert_html,
        )
    except Exception as alert_exc:
        logger.error("Resend alert send also failed: %s", alert_exc)

