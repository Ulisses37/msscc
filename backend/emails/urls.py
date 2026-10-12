from django.urls import path

from emails.views import AnnouncementSendView

urlpatterns = [
    path(
        "announcements/send/",
        AnnouncementSendView.as_view(),
        name="email-announcement-send",
    ),
]
