import logging
import re

import stripe
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import DatabaseError, transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from donations.models import Donation, Membership
from donations.processing_costs import calculate_donation_amounts
from donations.services import create_pending_membership, update_membership_from_payment_intent
from payments.serializers import (
    MEMBERSHIP_PRICES,
    MembershipPaymentSessionRequestSerializer,
    MembershipPaymentStatusSerializer,
    MembershipQuoteRequestSerializer,
    PaymentReceiptSerializer,
    PaymentSessionRequestSerializer,
)
from payments.services.stripe_service import (
    create_payment_session,
)

# Use Django's logging configuration instead of printing errors directly.
logger = logging.getLogger(__name__)

# Donation references are generated from database IDs. Webhook metadata and
# Stripe object fields are still external input, even after signature checking.
DONATION_REFERENCE_PATTERN = re.compile(r"DON-[0-9]{8,}\Z")
MEMBERSHIP_REFERENCE_PATTERN = re.compile(r"MEM-[0-9a-f]{32}\Z")
PAYMENT_INTENT_ID_PATTERN = re.compile(r"pi_[A-Za-z0-9_]{1,252}\Z")
STRIPE_EVENT_ID_PATTERN = re.compile(r"evt_[A-Za-z0-9]{1,251}\Z")
STRIPE_REQUEST_ID_PATTERN = re.compile(r"req_[A-Za-z0-9]{1,251}\Z")


def _is_donation_reference(value):
    """Require an exact generated reference before querying or updating a row."""
    return isinstance(value, str) and DONATION_REFERENCE_PATTERN.fullmatch(value) is not None


def _safe_event_id(value):
    """Avoid multiline or attacker-controlled log content from event metadata."""
    if isinstance(value, str) and STRIPE_EVENT_ID_PATTERN.fullmatch(value):
        return value
    return "unavailable"


def _safe_request_id(value):
    """Only log a Stripe request ID, never an exception or response payload."""
    if isinstance(value, str) and STRIPE_REQUEST_ID_PATTERN.fullmatch(value):
        return value
    return "unavailable"


class PaymentSessionCreateView(APIView):
    """
    Receive payment-session requests and create Stripe Checkout Sessions.

    This view is responsible for HTTP request validation and responses.
    Stripe-specific session creation remains in the reusable service.
    """

    # A user must be able to begin a donation without logging into an
    # administrator account.
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        """
        Validate the request, call the Stripe service, and return the
        information required by the frontend.
        """

        # Pass the incoming JSON body to the serializer.
        serializer = PaymentSessionRequestSerializer(data=request.data)

        # Validate all fields. When validation fails, DRF automatically
        # returns a 400 response containing the field validation errors.
        serializer.is_valid(raise_exception=True)

        # Use validated_data instead of request.data so only cleaned,
        # validated values are passed to the payment service.
        validated_data = serializer.validated_data

        internal_reference = validated_data["internal_reference"]

        # Only an existing pending donation can use this checkout route. A
        # client-controlled price must never reach Stripe for other references.
        try:
            donation = Donation.objects.only("amount", "total_amount", "payment_status").get(
                reference_id=internal_reference
            )
        except Donation.DoesNotExist:
            return Response(
                {"detail": "Donation was not found."}, status=status.HTTP_404_NOT_FOUND
            )
        except Donation.MultipleObjectsReturned:
            logger.error("Payment session request matched multiple donations.")
            return Response(
                {"detail": "Unable to create payment session."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except DatabaseError:
            # Do not expose backend exception text in responses or logs.
            logger.error("Database error while loading a donation for payment.")
            return Response(
                {"detail": "Payment processing is temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if donation.payment_status != Donation.PaymentStatus.PENDING:
            return Response(
                {"detail": "This donation cannot start another payment."},
                status=status.HTTP_409_CONFLICT,
            )
        # The donation form still sends its base amount as a stale-record
        # guard. It must not choose the price charged by Stripe.
        if donation.amount != validated_data["amount"]:
            return Response(
                {"detail": "Payment amount does not match the donation."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Stripe receives the saved server-calculated total, never either the
        # preview quote or a browser-provided contribution/total.
        payment_amount = donation.total_amount

        # Construct the return URL on the server. Accepting a complete return
        # URL from the browser could allow an attacker to redirect a user to
        # an untrusted website.
        #
        # Stripe replaces {CHECKOUT_SESSION_ID} with the actual session ID
        # when it sends the user back to the application.
        return_url = (
            f"{settings.FRONTEND_URL.rstrip('/')}/en/support?session_id={{CHECKOUT_SESSION_ID}}"
        )

        try:
            # Call the reusable service created in SCRUM-561.
            payment_session = create_payment_session(
                amount=payment_amount,
                currency=validated_data["currency"],
                payment_purpose=validated_data["payment_purpose"],
                internal_reference=internal_reference,
                return_url=return_url,
            )

        except ValueError:
            # Service errors may include sensitive upstream context; never echo them.
            return Response(
                {"detail": "Invalid payment information."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except (stripe.StripeError, RuntimeError) as exc:
            # StripeError represents problems reported by Stripe, including
            # authentication, connection, rate-limit, and API errors.
            #
            # RuntimeError handles the service failing to receive a required
            # client secret from Stripe.
            request_id = _safe_request_id(getattr(exc, "request_id", None))

            # The Stripe request ID can help developers find the failed
            # request in Stripe's logs. Do not log keys, client secrets,
            # full Stripe responses, or payment information.
            logger.error(
                "Unable to create Stripe payment session. request_id=%s",
                request_id,
            )

            # Return a controlled response instead of exposing Stripe's
            # internal error information to the frontend.
            return Response(
                {"detail": "Unable to create payment session."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # A new Stripe Checkout Session was created successfully.
        # The response contains only its ID and client secret.
        return Response(
            payment_session,
            status=status.HTTP_201_CREATED,
        )


class MembershipPaymentSessionCreateView(APIView):
    """Create a PaymentIntent using only the backend's membership catalog."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = MembershipPaymentSessionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        option_id = serializer.validated_data["membership_option_id"]

        try:
            # Never take amount or currency from request.data. The frontend's
            # display price is not authoritative even when it happens to match.
            payment_session = create_pending_membership(
                option_id=option_id,
                contribute_to_processing_costs=serializer.validated_data["contribute_to_processing_costs"],
                first_name=serializer.validated_data["first_name"],
                last_name=serializer.validated_data["last_name"],
                email=serializer.validated_data["email"],
                phone=serializer.validated_data.get("phone", ""),
            )
        except DatabaseError:
            logger.error("Database error while creating a pending membership.")
            return Response(
                {"detail": "Payment processing is temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except (stripe.StripeError, RuntimeError, ValueError, ImproperlyConfigured):
            # Exception text and Stripe objects may contain sensitive details.
            logger.error("Unable to create membership payment session.")
            return Response(
                {"detail": "Unable to create payment session."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(payment_session, status=status.HTTP_201_CREATED)


class MembershipQuoteView(APIView):
    """Preview the server catalog price and optional processing contribution."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = MembershipQuoteRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        base = MEMBERSHIP_PRICES[serializer.validated_data["membership_option_id"]]
        contribution, total = calculate_donation_amounts(
            base, serializer.validated_data["contribute_to_processing_costs"]
        )
        return Response({"amount": f"{base:.2f}",
                         "processing_cost_contribution": f"{contribution:.2f}",
                         "total_amount": f"{total:.2f}"})


# Maps Stripe events to the lowercase values stored in Donation.payment_status.
#
# Checkout Session events cover completed, delayed, and expired payments.
# PaymentIntent events also let the application recognize immediate card
# successes, failures, and cancellations.
PAYMENT_STATUS_BY_EVENT = {
    # Map only the Stripe events that are allowed to change Donation records.
    # Using TextChoices values keeps this mapping aligned with the model and
    # its database constraint.
    "payment_intent.succeeded": Donation.PaymentStatus.COMPLETED,
    "payment_intent.payment_failed": Donation.PaymentStatus.FAILED,
    "payment_intent.canceled": Donation.PaymentStatus.CANCELED,
    "checkout.session.async_payment_succeeded": Donation.PaymentStatus.COMPLETED,
    "checkout.session.async_payment_failed": Donation.PaymentStatus.FAILED,
    "checkout.session.expired": Donation.PaymentStatus.CANCELED,
}


def _get_payment_status(event_type, stripe_object):
    """
    Convert a supported Stripe event into an application payment status.

    A Checkout Session can be completed before a delayed payment has actually
    been paid. Therefore, checkout.session.completed is only treated as
    completed when Stripe reports payment_status as paid.
    """
    if event_type == "checkout.session.completed":
        if stripe_object.get("payment_status") == "paid":
            return Donation.PaymentStatus.COMPLETED

        # Keep an unpaid or processing Checkout Session pending.
        return None

    return PAYMENT_STATUS_BY_EVENT.get(event_type)


def _get_internal_reference(stripe_object):
    """
    Find the internal donation reference attached to a Stripe object.

    Checkout Sessions contain client_reference_id. PaymentIntents receive the
    same reference through metadata when the session is created.
    """
    if not isinstance(stripe_object, dict):
        return None
    client_reference_id = stripe_object.get("client_reference_id")

    if client_reference_id:
        return client_reference_id

    metadata = stripe_object.get("metadata") or {}
    return metadata.get("internal_reference") if isinstance(metadata, dict) else None


def _update_donation_payment_status(reference_id, new_status):
    """Atomically update only the payment status of one donation."""
    # Validate before opening a transaction or issuing a database query. This
    # also protects callers other than the webhook view from writing new,
    # unsupported status strings.
    if new_status not in Donation.PaymentStatus.values:
        raise ValueError("Unsupported donation payment status.")
    if not _is_donation_reference(reference_id):
        raise ValueError("Invalid donation reference.")

    # The row lock serializes concurrent Stripe deliveries for this Donation.
    # Without it, two events could both read an old value and then write their
    # results in an unsafe order.
    with transaction.atomic():
        donation = (
            Donation.objects.select_for_update()
            .only("donation_id", "payment_status")
            .get(reference_id=reference_id)
        )

        # Stripe events may arrive more than once or out of order. Once a
        # donation is completed, a late failure or expiration cannot undo it.
        if (
            donation.payment_status == Donation.PaymentStatus.COMPLETED
            and new_status != Donation.PaymentStatus.COMPLETED
        ):
            return False

        if donation.payment_status == new_status:
            # Stripe retries events. Avoid a duplicate write when the desired
            # status is already stored.
            return False

        # Only the verified transition to completed records a receipt date;
        # duplicate and late events cannot rewrite the original timestamp.
        update = {"payment_status": new_status}
        if new_status == Donation.PaymentStatus.COMPLETED:
            update["completed_at"] = timezone.now()
        if Donation.objects.filter(pk=donation.pk).update(**update) != 1:
            # A missing write must never be reported as a successful update.
            # Raising inside atomic() rolls back the transaction.
            raise DatabaseError("Donation payment status was not updated.")
        return True


class PaymentReceiptView(APIView):
    """Expose a small, database-backed receipt for completed checkout payments."""

    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        reference = request.query_params.get("confirmation_reference")
        not_found = {"detail": "Receipt was not found."}
        # Treat unknown, malformed, and non-completed references identically.
        if not isinstance(reference, str):
            return Response(not_found, status=status.HTTP_404_NOT_FOUND)
        try:
            if MEMBERSHIP_REFERENCE_PATTERN.fullmatch(reference):
                payment = Membership.objects.defer(
                    "first_name_encrypted", "last_name_encrypted", "email_encrypted",
                    "phone_encrypted", "address_encrypted",
                ).get(
                    checkout_reference=reference,
                    stripe_payment_intent_id__isnull=False,
                    payment_status=Membership.PaymentStatus.COMPLETED,
                    completed_at__isnull=False,
                )
                # Only checkout catalog IDs may be shown; never use legacy
                # free-text membership_type or other member profile fields.
                if payment.membership_option_id not in MEMBERSHIP_PRICES:
                    return Response(not_found, status=status.HTTP_404_NOT_FOUND)
                receipt = {
                    "payment_purpose": "membership",
                    "amount": payment.amount_paid,
                    "currency": payment.currency,
                    "completed_at": payment.completed_at,
                    "confirmation_reference": payment.checkout_reference,
                    "membership_option": payment.membership_option_id,
                }
                if payment.base_amount is not None:
                    receipt.update({
                        "base_amount": payment.base_amount,
                        "processing_cost_contribution": payment.processing_cost_contribution,
                        "total_amount": payment.amount_paid,
                    })
            elif DONATION_REFERENCE_PATTERN.fullmatch(reference):
                payment = Donation.objects.defer(
                    "donor_first_name_encrypted", "donor_last_name_encrypted",
                    "donor_email_encrypted",
                ).get(
                    reference_id=reference,
                    payment_status=Donation.PaymentStatus.COMPLETED,
                    completed_at__isnull=False,
                )
                # A donor message is not a donation purpose; omit optional
                # purpose until a dedicated backend field is available.
                # Use the stored breakdown, not today's pricing constants:
                # rates may change after a donation was paid.
                receipt = {
                    "payment_purpose": "donation",
                    "amount": payment.total_amount,
                    "base_amount": payment.amount,
                    "processing_cost_contribution": payment.processing_cost_contribution,
                    "total_amount": payment.total_amount,
                    "currency": payment.currency,
                    "completed_at": payment.completed_at,
                    "confirmation_reference": payment.reference_id,
                }
            else:
                return Response(not_found, status=status.HTTP_404_NOT_FOUND)
        except (Donation.DoesNotExist, Membership.DoesNotExist):
            return Response(not_found, status=status.HTTP_404_NOT_FOUND)
        except Donation.MultipleObjectsReturned:
            logger.error("Receipt lookup matched multiple donations.")
            return Response(
                {"detail": "Receipt is temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except DatabaseError:
            logger.error("Database error while retrieving payment receipt.")
            return Response(
                {"detail": "Receipt is temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Explicit serializer fields prevent new model fields from leaking.
        result = PaymentReceiptSerializer(receipt)
        return Response(result.data, status=status.HTTP_200_OK)


class MembershipPaymentStatusView(APIView):
    """Read the locally verified checkout state without contacting Stripe."""

    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        reference = request.query_params.get("confirmation_reference")
        not_found = {"detail": "Payment status was not found."}
        # A malformed or unknown reference has the same public response. The
        # exact UUID-derived namespace is checked before touching the database.
        if not isinstance(reference, str) or not MEMBERSHIP_REFERENCE_PATTERN.fullmatch(reference):
            return Response(not_found, status=status.HTTP_404_NOT_FOUND)

        try:
            # Exclude legacy/manual records: only a Stripe-linked checkout can
            # be confirmed through this public reference lookup.
            membership = Membership.objects.only("payment_status").get(
                checkout_reference=reference, stripe_payment_intent_id__isnull=False
            )
        except Membership.DoesNotExist:
            return Response(not_found, status=status.HTTP_404_NOT_FOUND)
        except DatabaseError:
            logger.error("Database error while retrieving a membership payment status.")
            return Response(
                {"detail": "Payment status is temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Internal 'completed' becomes the result page's 'complete'. Never
        # infer success from the browser, the membership's provisional dates,
        # or an unrecognized legacy/admin payment status.
        public_status = {
            Membership.PaymentStatus.PENDING: "pending",
            Membership.PaymentStatus.COMPLETED: "complete",
            Membership.PaymentStatus.FAILED: "failed",
            Membership.PaymentStatus.CANCELED: "canceled",
        }.get(membership.payment_status)
        if public_status is None:
            logger.error("Membership contains an unsupported payment status.")
            return Response(
                {"detail": "Payment status is temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # A serializer allowlist prevents model fields (PII, IDs, secrets) from
        # accidentally leaking if the underlying membership model changes.
        result = MembershipPaymentStatusSerializer(
            {"payment_purpose": "membership", "payment_status": public_status}
        )
        return Response(result.data, status=status.HTTP_200_OK)


class PaymentStatusView(APIView):
    """Return the webhook-confirmed status for one Stripe Checkout Session."""

    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        """Resolve a Stripe session to its donation and return only its status."""

        raw_session_id = request.query_params.get("session_id", "")
        session_id = raw_session_id.strip() if isinstance(raw_session_id, str) else ""

        # Checkout Session IDs are safe browser values, but reject malformed
        # input before making a request to Stripe.
        valid_prefix = session_id.startswith(("cs_test_", "cs_live_"))

        if not valid_prefix or len(session_id) > 255:
            return Response(
                {"detail": "A valid payment session is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not settings.STRIPE_SECRET_KEY:
            logger.error("Stripe secret key is not configured.")
            return Response(
                {"detail": "Payment status is temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            checkout_session = stripe.checkout.Session.retrieve(
                session_id,
                api_key=settings.STRIPE_SECRET_KEY,
            )
            session_data = checkout_session.to_dict()
        except stripe.InvalidRequestError:
            # Do not return Stripe's raw error or reveal whether another
            # internal payment reference exists.
            return Response(
                {"detail": "Payment status was not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except stripe.StripeError as exc:
            logger.error(
                "Unable to retrieve Stripe payment session. request_id=%s",
                _safe_request_id(getattr(exc, "request_id", None)),
            )
            return Response(
                {"detail": "Payment status is temporarily unavailable."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        reference_id = _get_internal_reference(session_data)

        if not _is_donation_reference(reference_id):
            return Response(
                {"detail": "Payment status was not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            donation = Donation.objects.only("payment_status").get(
                reference_id=reference_id,
            )
        except Donation.DoesNotExist:
            return Response(
                {"detail": "Payment status was not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Donation.MultipleObjectsReturned:
            logger.error("Payment status lookup matched multiple donations.")
            return Response(
                {"detail": "Payment status is temporarily unavailable."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except DatabaseError:
            # Do not log the exception, session ID, donation reference, or any
            # Stripe response data. The fixed 503 is safe for the browser.
            logger.error("Database error while retrieving a donation payment status.")
            return Response(
                {"detail": "Payment status is temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if donation.payment_status not in Donation.PaymentStatus.values:
            logger.error("Donation contains an unsupported payment status.")
            return Response(
                {"detail": "Payment status is temporarily unavailable."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        result = {"payment_status": donation.payment_status}
        # Only a completed, database-confirmed donation needs its internal
        # reference on the Stripe return page to request a separate receipt.
        if donation.payment_status == Donation.PaymentStatus.COMPLETED:
            result["confirmation_reference"] = reference_id
        return Response(result, status=status.HTTP_200_OK)


class StripeWebhookView(APIView):
    """
    Receive verified Stripe events and update donation or membership payments.

    This endpoint does not use login authentication because Stripe calls it
    directly. Instead, every request must have a valid Stripe signature.
    """

    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        """Verify the Stripe event before updating any payment record."""

        webhook_secret = settings.STRIPE_WEBHOOK_SECRET

        if not webhook_secret:
            logger.error("Stripe webhook secret is not configured.")
            return Response(
                {"detail": "Webhook is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        signature = request.headers.get("Stripe-Signature")

        if not signature:
            return Response(
                {"detail": "Missing Stripe signature."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            event = stripe.Webhook.construct_event(
                payload=request.body,
                sig_header=signature,
                secret=webhook_secret,
            )

            # Stripe returns StripeObject resources instead of ordinary
            # dictionaries. Convert the entire verified event so dictionary
            # methods such as .get() can be used safely below.
            event_data = event.to_dict()

        except ValueError:
            # Never log the unverified body or signature.
            logger.warning("Invalid Stripe webhook payload.")
            return Response(
                {"detail": "Invalid webhook payload."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except stripe.SignatureVerificationError:
            logger.warning("Invalid Stripe webhook signature.")
            return Response(
                {"detail": "Invalid webhook signature."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Signed payloads can still have an unexpected shape. Fail safely
        # without including the event or its data in the response or logs.
        if not isinstance(event_data, dict) or not isinstance(event_data.get("data"), dict):
            return Response(
                {"detail": "Invalid webhook payload."}, status=status.HTTP_400_BAD_REQUEST
            )
        event_type = event_data.get("type")
        stripe_object = event_data["data"].get("object")
        if not isinstance(event_type, str) or not isinstance(stripe_object, dict):
            return Response(
                {"detail": "Invalid webhook payload."}, status=status.HTTP_400_BAD_REQUEST
            )
        event_id = _safe_event_id(event_data.get("id"))

        reference_id = _get_internal_reference(stripe_object)
        # Membership checkout creates PaymentIntents, not Checkout Sessions.
        # Route only its own event namespace after signature verification;
        # donation event behavior remains unchanged below.
        if isinstance(reference_id, str) and reference_id.startswith("MEM-"):
            if event_type not in (
                "payment_intent.succeeded", "payment_intent.payment_failed",
                "payment_intent.canceled",
            ):
                return Response({"received": True}, status=status.HTTP_200_OK)
            intent_id = stripe_object.get("id")
            if (
                MEMBERSHIP_REFERENCE_PATTERN.fullmatch(reference_id) is None
                or not isinstance(intent_id, str)
                or PAYMENT_INTENT_ID_PATTERN.fullmatch(intent_id) is None
                or not isinstance(stripe_object.get("metadata"), dict)
                or stripe_object["metadata"].get("payment_purpose") != "membership"
            ):
                logger.warning("Stripe membership event has invalid linkage. event_id=%s", event_id)
                return Response({"received": True}, status=status.HTTP_200_OK)
            try:
                update_membership_from_payment_intent(
                    reference=reference_id, intent_id=intent_id,
                    event_type=event_type, intent=stripe_object,
                    event_created=event_data.get("created"),
                )
            except Membership.DoesNotExist:
                logger.warning("Stripe event did not match a membership. event_id=%s", event_id)
            except DatabaseError:
                logger.error(
                    "Database error while processing a membership event. event_id=%s", event_id
                )
                return Response(
                    {"detail": "Webhook processing is temporarily unavailable."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            return Response({"received": True}, status=status.HTTP_200_OK)

        new_status = _get_payment_status(event_type, stripe_object)

        # Stripe sends many event types. Unsupported events are acknowledged
        # without changing any database records.
        if new_status is None:
            return Response(
                {"received": True},
                status=status.HTTP_200_OK,
            )

        # Only donation references belong in the Donation table. This prevents
        # future membership events from updating donation records.
        if not _is_donation_reference(reference_id):
            logger.warning(
                "Stripe payment event has no valid donation reference. event_id=%s",
                event_id,
            )
            return Response(
                {"received": True},
                status=status.HTTP_200_OK,
            )

        try:
            # The helper validates the status, locks the matching row, and
            # restricts the update to the payment_status column.
            _update_donation_payment_status(reference_id, new_status)
        except Donation.DoesNotExist:
            # Returning 200 prevents Stripe from retrying an event that cannot
            # be matched to a record in this environment.
            logger.warning(
                "Stripe payment event did not match a donation. event_id=%s",
                event_id,
            )
            return Response(
                {"received": True},
                status=status.HTTP_200_OK,
            )
        except Donation.MultipleObjectsReturned:
            # Do not update anything if the reference is unexpectedly duplicated.
            logger.error(
                "Stripe payment event matched multiple donations. event_id=%s",
                event_id,
            )
            return Response(
                {"received": True},
                status=status.HTTP_200_OK,
            )
        except DatabaseError:
            # A temporary database failure should return a retryable response.
            # Do not include the exception, donation reference, or Stripe
            # payload in the response or log entry.
            logger.error(
                "Database error while processing a Stripe event. event_id=%s",
                event_id,
            )
            return Response(
                {"detail": "Webhook processing is temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {"received": True},
            status=status.HTTP_200_OK,
        )
