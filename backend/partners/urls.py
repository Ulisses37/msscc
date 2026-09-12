from django.urls import path

from partners.views import PartnerListView, PartnerDetailView, PartnerCreateView, PartnerDeleteView

urlpatterns = [
    path("", PartnerListView.as_view(), name="partner-list"),
    path("<int:partner_id>/", PartnerDetailView.as_view(), name="partner-detail"),
    path("create/", PartnerCreateView.as_view(), name="partner-create"),
    path("<int:partner_id>/delete/", PartnerDeleteView.as_view(), name="partner-delete"),
]
