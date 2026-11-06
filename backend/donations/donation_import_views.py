"""Authorized donation CSV entry points, separate from public checkout."""

from django.http import HttpResponse
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from donations.donation_csv_contract import MAX_DONATION_CSV_BYTES, donation_csv_template
from donations.donation_csv_preview import parse_donation_csv
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


class DonationCsvPreviewView(APIView):
    """Authorize and inspect donation uploads without persisting any proposed facts."""

    # Access is checked before reading multipart data in the view. This path
    # never shares public checkout's permission or creation serializer.
    permission_classes = [HasFinancialRecordPermission]
    parser_classes = [MultiPartParser]

    def finalize_response(self, request, response, *args, **kwargs):
        """Prevent caching private preview data, including error responses."""
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store, private"
        return response

    def post(self, request):
        """Read at most the published byte limit plus one and run read-only rules."""
        upload = request.FILES.get("file")
        # QueryDict.get returns only the last item for repeated keys. Check
        # getlist too so two uploads named "file" cannot silently pick one.
        if upload is None or len(request.FILES) != 1 or len(request.FILES.getlist("file")) != 1:
            return Response({"detail": "Provide one donation CSV file in the file field."},
                            status=status.HTTP_400_BAD_REQUEST)
        if upload.size > MAX_DONATION_CSV_BYTES:
            return Response({"detail": "CSV must be at most 1,048,576 bytes."},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            # Never call read() without a bound; the parser checks the actual
            # bytes again so a misleading upload size cannot bypass the limit.
            raw = upload.read(MAX_DONATION_CSV_BYTES + 1)
        except OSError:
            # Upload exceptions can contain file paths or original input.
            return Response({"detail": "Unable to read the CSV file."},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response(parse_donation_csv(raw), status=status.HTTP_200_OK)
