from django.http import HttpResponse
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from donations.membership_csv_contract import MAX_MEMBERSHIP_CSV_BYTES, membership_csv_template
from donations.membership_csv_preview import parse_membership_csv
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


class MembershipCsvPreviewView(APIView):
    """Authorize and validate membership CSVs; never persist preview data."""

    permission_classes = [HasFinancialRecordPermission]
    parser_classes = [MultiPartParser]

    def finalize_response(self, request, response, *args, **kwargs):
        """Private proposed contacts must not be cached by a browser or intermediary."""
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store, private"
        return response

    def post(self, request):
        """Read no more than the contracted size plus one byte from the upload."""
        upload = request.FILES.get("file")
        if upload is None or len(request.FILES) != 1:
            return Response({"detail": "Provide one membership CSV file in the file field."},
                            status=status.HTTP_400_BAD_REQUEST)
        if upload.size > MAX_MEMBERSHIP_CSV_BYTES:
            return Response({"detail": "CSV must be at most 1,048,576 bytes."},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            raw = upload.read(MAX_MEMBERSHIP_CSV_BYTES + 1)
        except OSError:
            return Response({"detail": "Unable to read the CSV file."},
                            status=status.HTTP_400_BAD_REQUEST)
        preview = parse_membership_csv(raw)
        return Response(preview, status=status.HTTP_200_OK)
