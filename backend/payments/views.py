import logging

import stripe
from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

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

        # Construct the return URL on the server. Accepting a complete return
        # URL from the browser could allow an attacker to redirect a user to
        # an untrusted website.
        #
        # Stripe replaces {CHECKOUT_SESSION_ID} with the actual session ID
        # when it sends the user back to the application.
        return_url = (
            f"{settings.FRONTEND_URL.rstrip('/')}/payment/return"
            "?session_id={CHECKOUT_SESSION_ID}"
        )

        # for testing purposes, we can use a static return URL to avoid having to deal with the session ID in the frontend.
        return_url = f"{settings.FRONTEND_URL.rstrip('/')}/en/support"

        try:
            # Call the reusable service created in SCRUM-561.
            payment_session = create_payment_session(
                amount=validated_data["amount"],
                currency=validated_data["currency"],
                payment_purpose=validated_data["payment_purpose"],
                internal_reference=validated_data["internal_reference"],
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