from django.urls import path

from partners.views import PartnerListView, PartnerDetailView, PartnerCreateView

urlpatterns = [
    path("", PartnerListView.as_view(), name="partner-list"),
    path("<int:partner_id>/", PartnerDetailView.as_view(), name="partner-detail"),
    path("api/partners/create/", PartnerCreateView.as_view(), name="partner-create"),
]
