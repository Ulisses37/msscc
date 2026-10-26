import logging

from django.conf import settings

from donations.models import Donation, Membership
from emails.services import send_email

logger = logging.getLogger(__name__)


def _money(amount, currency):
    code = str(currency).lower()
    if code == "usd":
        return f"${amount:,.2f}"
    return f"{amount:,.2f} {code.upper()}"


def _amounts(base, contribution, total, currency):
    return {
        "base_amount": _money(base, currency) if base is not None else None,
        "contribution": _money(contribution or 0, currency),
        "total_amount": _money(total, currency),
        "tax_notice": getattr(settings, "RECEIPT_TAX_NOTICE", ""),
    }


def send_donation_receipt(donation_pk):
    """Email a receipt for a completed donation. Never raises."""
    try:
        donation = Donation.objects.get(pk=donation_pk)
        if donation.payment_status != Donation.PaymentStatus.COMPLETED:
            return
        to = donation.donor_email_encrypted
        if not to:
            logger.warning("Donation receipt skipped: no email on file.")
            return

        context = {
            "first_name": donation.donor_first_name_encrypted or "friend",
            "reference": donation.reference_id,
            "completed_at": donation.completed_at,
            **_amounts(
                donation.amount, donation.processing_cost_contribution,
                donation.total_amount, donation.currency,
            ),
        }
        send_email(to, "Your donation receipt — MSSCC",
                   "emails/donation_receipt.html", context)
    except Exception:
        logger.error("Failed to send donation receipt.")


def send_membership_receipt(membership_pk):
    """Email a receipt for a completed membership. Never raises."""
    try:
        membership = Membership.objects.get(pk=membership_pk)
        if membership.payment_status != Membership.PaymentStatus.COMPLETED:
            return
        to = membership.email_encrypted
        if not to:
            logger.warning("Membership receipt skipped: no email on file.")
            return

        currency = membership.currency or "usd"
        context = {
            "first_name": membership.first_name_encrypted or "member",
            "reference": membership.checkout_reference,
            "membership_option": (membership.membership_option_id or "").replace("_", " ").title(),
            "completed_at": membership.completed_at,
            "start_date": membership.start_date,
            "end_date": membership.end_date,
            "renewal_date": membership.renewal_date,
            **_amounts(
                membership.base_amount, membership.processing_cost_contribution,
                membership.amount_paid, currency,
            ),
        }
        send_email(to, "Your membership receipt — MSSCC",
                   "emails/membership_receipt.html", context)
    except Exception:
        logger.error("Failed to send membership receipt.")
