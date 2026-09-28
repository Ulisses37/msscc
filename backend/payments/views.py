import logging

import stripe
from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from donations.models import Donation

from payments.serializers import PaymentSessionRequestSerializer
from payments.services.stripe_service import create_payment_session


# Use Django's logging configuration instead of printing errors directly.
logger = logging.getLogger(__name__)


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

        # Donation payment sessions must match a real pending Donation. This
        # prevents a completed, failed, or canceled donation from starting a
        # second Stripe payment and prevents the browser from changing the
        # amount after the Donation record has been created.
        if internal_reference.startswith("DON-"):
            try:
                donation = Donation.objects.only(
                    "amount",
                    "payment_status",
                ).get(reference_id=internal_reference)
            except Donation.DoesNotExist:
                return Response(
                    {"detail": "Donation was not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            except Donation.MultipleObjectsReturned:
                logger.error(
                    "Payment session request matched multiple donations."
                )
                return Response(
                    {"detail": "Unable to create payment session."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            if donation.payment_status != "pending":
                return Response(
                    {"detail": "This donation cannot start another payment."},
                    status=status.HTTP_409_CONFLICT,
                )

            if donation.amount != validated_data["amount"]:
                return Response(
                    {"detail": "Payment amount does not match the donation."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Construct the return URL on the server. Accepting a complete return
        # URL from the browser could allow an attacker to redirect a user to
        # an untrusted website.
        #
        # Stripe replaces {CHECKOUT_SESSION_ID} with the actual session ID
        # when it sends the user back to the application.
        return_url = (
            f"{settings.FRONTEND_URL.rstrip('/')}/en/support"
            "?session_id={CHECKOUT_SESSION_ID}"
        )

        try:
            # Call the reusable service created in SCRUM-561.
            payment_session = create_payment_session(
                amount=validated_data["amount"],
                currency=validated_data["currency"],
                payment_purpose=validated_data["payment_purpose"],
                internal_reference=internal_reference,
                return_url=return_url,
            )

        except ValueError as exc:
            # The serializer performs most validation, but the service also
            # protects itself in case it is called from somewhere else.
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except (stripe.StripeError, RuntimeError) as exc:
            # StripeError represents problems reported by Stripe, including
            # authentication, connection, rate-limit, and API errors.
            #
            # RuntimeError handles the service failing to receive a required
            # client secret from Stripe.
            request_id = getattr(exc, "request_id", None)

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

# Maps Stripe events to the lowercase values stored in Donation.payment_status.
#
# Checkout Session events cover completed, delayed, and expired payments.
# PaymentIntent events also let the application recognize immediate card
# successes, failures, and cancellations.
PAYMENT_STATUS_BY_EVENT = {
    "payment_intent.succeeded": "completed",
    "payment_intent.payment_failed": "failed",
    "payment_intent.canceled": "canceled",
    "checkout.session.async_payment_succeeded": "completed",
    "checkout.session.async_payment_failed": "failed",
    "checkout.session.expired": "canceled",
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
            return "completed"

        # Keep an unpaid or processing Checkout Session pending.
        return None

    return PAYMENT_STATUS_BY_EVENT.get(event_type)


def _get_internal_reference(stripe_object):
    """
    Find the internal donation reference attached to a Stripe object.

    Checkout Sessions contain client_reference_id. PaymentIntents receive the
    same reference through metadata when the session is created.
    """
    client_reference_id = stripe_object.get("client_reference_id")

    if client_reference_id:
        return client_reference_id

    metadata = stripe_object.get("metadata") or {}
    return metadata.get("internal_reference")


class PaymentStatusView(APIView):
    """Return the webhook-confirmed status for one Stripe Checkout Session."""

    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        """Resolve a Stripe session to its donation and return only its status."""

        session_id = request.query_params.get("session_id", "").strip()

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
                getattr(exc, "request_id", None),
            )
            return Response(
                {"detail": "Payment status is temporarily unavailable."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        reference_id = _get_internal_reference(session_data)

        if not reference_id or not reference_id.startswith("DON-"):
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

        allowed_statuses = {"pending", "completed", "failed", "canceled"}

        if donation.payment_status not in allowed_statuses:
            logger.error("Donation contains an unsupported payment status.")
            return Response(
                {"detail": "Payment status is temporarily unavailable."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {"payment_status": donation.payment_status},
            status=status.HTTP_200_OK,
        )


class StripeWebhookView(APIView):
    """
    Receive verified Stripe events and update donation payment statuses.

    This endpoint does not use login authentication because Stripe calls it
    directly. Instead, every request must have a valid Stripe signature.
    """

    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        """Verify the Stripe event before updating a donation."""

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
            return Response(
                {"detail": "Invalid webhook payload."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except stripe.SignatureVerificationError:
            return Response(
                {"detail": "Invalid webhook signature."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        event_type = event_data["type"]
        stripe_object = event_data["data"]["object"]

        # Continue with the existing webhook-processing code below.

        new_status = _get_payment_status(event_type, stripe_object)

        # Stripe sends many event types. Unsupported events are acknowledged
        # without changing any database records.
        if new_status is None:
            return Response(
                {"received": True},
                status=status.HTTP_200_OK,
            )

        reference_id = _get_internal_reference(stripe_object)

        # Only donation references belong in the Donation table. This prevents
        # future membership events from updating donation records.
        if not reference_id or not reference_id.startswith("DON-"):
            logger.warning(
                "Stripe payment event has no valid donation reference. event_id=%s",
                event_data.get("id"),
            )
            return Response(
                {"received": True},
                status=status.HTTP_200_OK,
            )

        try:
            donation = Donation.objects.get(reference_id=reference_id)
        except Donation.DoesNotExist:
            # Returning 200 prevents Stripe from retrying an event that cannot
            # be matched to a record in this environment.
            logger.warning(
                "Stripe payment event did not match a donation. event_id=%s",
                event_data.get("id"),
            )
            return Response(
                {"received": True},
                status=status.HTTP_200_OK,
            )
        except Donation.MultipleObjectsReturned:
            # Do not update anything if the reference is unexpectedly duplicated.
            logger.error(
                "Stripe payment event matched multiple donations. event_id=%s",
                event_data.get("id"),
            )
            return Response(
                {"received": True},
                status=status.HTTP_200_OK,
            )

        # A late failure or expiration event must not change an already
        # completed donation back to failed or canceled.
        if donation.payment_status == "completed" and new_status != "completed":
            return Response(
                {"received": True},
                status=status.HTTP_200_OK,
            )

        # Duplicate webhook deliveries are safe because the same value is not
        # written again.
        if donation.payment_status != new_status:
            donation.payment_status = new_status
            donation.save(update_fields=["payment_status"])

        return Response(
            {"received": True},
            status=status.HTTP_200_OK,
        )
