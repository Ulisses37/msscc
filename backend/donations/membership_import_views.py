from django.http import HttpResponse
from rest_framework.views import APIView

from donations.membership_csv_contract import membership_csv_template
from donations.permissions import HasFinancialRecordPermission


class MembershipCsvTemplateView(APIView):
    """Offer the membership import template only to active financial admins."""

    permission_classes = [HasFinancialRecordPermission]

    def get(self, request):
        """Generate the CSV from the server contract, independent of record exports."""
        response = HttpResponse(membership_csv_template(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="membership-import-template.csv"'
        response["Cache-Control"] = "no-store, private"
        response["X-Content-Type-Options"] = "nosniff"
        return response
