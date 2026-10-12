from django.urls import path

from emails.views import AnnouncementSendView, SubscribeView

urlpatterns = [
    path(
        "announcements/send/",
        AnnouncementSendView.as_view(),
        name="email-announcement-send",
    ),
    path("subscribe/", SubscribeView.as_view(), name="email-subscribe"),
]
