from django.urls import path

from emails.views import AnnouncementSendView, ResendWebhookView, SubscribeView

urlpatterns = [
    path(
        "announcements/send/",
        AnnouncementSendView.as_view(),
        name="email-announcement-send",
    ),
    path("subscribe/", SubscribeView.as_view(), name="email-subscribe"),
    # Resend-specific: the Svix signature, not a token, authenticates this.
    path(
        "webhooks/resend/",
        ResendWebhookView.as_view(),
        name="email-resend-webhook",
    ),
]
