"""Authorized donation CSV entry points, separate from public checkout."""

from django.http import HttpResponse
from rest_framework.views import APIView

from donations.donation_csv_contract import donation_csv_template
from donations.permissions import HasFinancialRecordPermission


class DonationCsvTemplateView(APIView):
    """Only active financial-record admins may download the fixed donation template."""

    # Checking permissions at this endpoint matters even if the admin page
    # hides its button: a caller can request the URL without using the UI.
    permission_classes = [HasFinancialRecordPermission]

    def get(self, request):
        """Generate the separate, header-only contract without loading donor records."""
        # Serve the same contract that the upcoming parser will enforce. A
        # public static file or configurable record export could drift or
        # include private columns that are unsafe to accept on import.
        response = HttpResponse(donation_csv_template(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="donation-import-template.csv"'
        # Treat even this header-only admin response as private and prevent
        # caching or content sniffing at the browser/intermediary boundary.
        response["Cache-Control"] = "no-store, private"
        response["X-Content-Type-Options"] = "nosniff"
        return response
