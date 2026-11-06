from django.urls import path

from donations.donation_import_views import DonationCsvTemplateView
from donations.membership_import_views import (
    MembershipCsvConfirmView,
    MembershipCsvPreviewView,
    MembershipCsvTemplateView,
)
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
    # Import template has its own finance-protected route; it neither lists
    # existing donors nor changes the public/manual donation creation paths.
    path("import/template/", DonationCsvTemplateView.as_view(), name="donation-import-template"),
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
        "memberships/import/confirm/",
        MembershipCsvConfirmView.as_view(),
        name="membership-import-confirm",
    ),
    path(
        "memberships/<int:membership_id>/",
        MembershipDetailView.as_view(),
        name="membership-detail",
    ),
]
