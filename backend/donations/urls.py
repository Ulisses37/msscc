from django.urls import path

from donations.membership_import_views import MembershipCsvPreviewView, MembershipCsvTemplateView
from donations.views import (
    AdminTableRevisionView,
    DonationDetailView,
    DonationListCreateView,
    DonationQuoteView,
    FinancialRecordSubscriptionStatusView,
    ManualDonationCreateView,
    MembershipDetailView,
    MembershipListCreateView,
)

urlpatterns = [
    path(
        "<int:donation_id>/subscription-status/",
        FinancialRecordSubscriptionStatusView.as_view(),
        name="donation-subscription-status",
    ),
    path(
        "memberships/<int:membership_id>/subscription-status/",
        FinancialRecordSubscriptionStatusView.as_view(),
        name="membership-subscription-status",
    ),
    # Put the public price preview alongside donation creation; it does not
    # create a record or accept client-supplied contribution/total fields.
    path("quote/", DonationQuoteView.as_view(), name="donation-quote"),
    path("manual/", ManualDonationCreateView.as_view(), name="manual-donation-create"),
    path(
        "table-revisions/",
        AdminTableRevisionView.as_view(),
        name="admin-table-revisions",
    ),
    path("", DonationListCreateView.as_view(), name="donation-list"),
    path("<int:donation_id>/", DonationDetailView.as_view(), name="donation-detail"),
    path("memberships/", MembershipListCreateView.as_view(), name="membership-list"),
    path(
        "memberships/import/template/",
        MembershipCsvTemplateView.as_view(),
        name="membership-import-template",
    ),
    path(
        "memberships/import/preview/",
        MembershipCsvPreviewView.as_view(),
        name="membership-import-preview",
    ),
    path(
        "memberships/<int:membership_id>/",
        MembershipDetailView.as_view(),
        name="membership-detail",
    ),
]
