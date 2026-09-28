from django.urls import path

from payments.views import (
    PaymentSessionCreateView,
    PaymentStatusView,
    StripeWebhookView,
)


urlpatterns = [
    # POST /api/payments/session/
    #
    # This route receives the validated payment information and creates
    # a Stripe Checkout Session through the reusable payment service.
    path(
        "session/",
        PaymentSessionCreateView.as_view(),
        name="payment-session-create",
    ),
    # GET /api/payments/status/?session_id=cs_...
    path(
        "status/",
        PaymentStatusView.as_view(),
        name="payment-status",
    ),
    # POST /api/payments/webhook/
    path(
        "webhook/",
        StripeWebhookView.as_view(),
        name="stripe-webhook",
    ),
]
