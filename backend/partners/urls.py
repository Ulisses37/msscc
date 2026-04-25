from django.urls import path

from partners.views import PartnerListView, PartnerDetailView

urlpatterns = [
    path("", PartnerListView.as_view(), name="partner-list"),
    path("<int:partner_id>/", PartnerDetailView.as_view(), name="partner-detail"),
]
