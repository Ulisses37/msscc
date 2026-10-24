from django.urls import path

from donations.views import (
    AdminTableRevisionView,
    DonationDetailView,
    DonationListCreateView,
    DonationQuoteView,
    MembershipDetailView,
    MembershipListCreateView,
)

urlpatterns = [
    # Put the public price preview alongside donation creation; it does not
    # create a record or accept client-supplied contribution/total fields.
    path("quote/", DonationQuoteView.as_view(), name="donation-quote"),
    path(
        "table-revisions/",
        AdminTableRevisionView.as_view(),
        name="admin-table-revisions",
    ),
    path("", DonationListCreateView.as_view(), name="donation-list"),
    path("<int:donation_id>/", DonationDetailView.as_view(), name="donation-detail"),
    path("memberships/", MembershipListCreateView.as_view(), name="membership-list"),
    path(
        "memberships/<int:membership_id>/",
        MembershipDetailView.as_view(),
        name="membership-detail",
    ),
]
