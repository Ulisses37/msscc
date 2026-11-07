"""Authorized donation CSV entry points, separate from public checkout."""

import logging

from django.core.exceptions import ImproperlyConfigured
from django.db import DatabaseError
from django.http import HttpResponse
from django.utils.crypto import salted_hmac
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from config.encryption import EncryptedTextError
from donations.donation_csv_confirmation import (
    batch_fingerprint,
    batch_result,
    confirm_review,
    make_review_token,
    read_review_token,
)
from donations.donation_csv_contract import MAX_DONATION_CSV_BYTES, donation_csv_template
from donations.donation_csv_duplicates import donation_duplicate_warnings
from donations.donation_csv_preview import parse_donation_csv
from donations.models import DonationImportBatch
from donations.permissions import HasFinancialRecordPermission

logger = logging.getLogger(__name__)


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


class DonationCsvUploadView(APIView):
    """Authorize and bound both preview and confirmation uploads."""

    # Access is checked before reading multipart data in the view. This path
    # never shares public checkout's permission or creation serializer.
    permission_classes = [HasFinancialRecordPermission]
    parser_classes = [MultiPartParser]

    def finalize_response(self, request, response, *args, **kwargs):
        """Prevent caching private preview data, including error responses."""
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store, private"
        return response

    def read_upload(self, request):
        """Read at most the published byte limit plus one from one multipart file."""
        upload = request.FILES.get("file")
        # QueryDict.get returns only the last item for repeated keys. Check
        # getlist too so two uploads named "file" cannot silently pick one.
        if upload is None or len(request.FILES) != 1 or len(request.FILES.getlist("file")) != 1:
            return None, Response({"detail": "Provide one donation CSV file in the file field."},
                                  status=status.HTTP_400_BAD_REQUEST)
        if upload.size > MAX_DONATION_CSV_BYTES:
            return None, Response({"detail": "CSV must be at most 1,048,576 bytes."},
                                  status=status.HTTP_400_BAD_REQUEST)
        try:
            # Never call read() without a bound; the parser checks the actual
            # bytes again so a misleading upload size cannot bypass the limit.
            raw = upload.read(MAX_DONATION_CSV_BYTES + 1)
        except OSError:
            # Upload exceptions can contain file paths or original input.
            return None, Response({"detail": "Unable to read the CSV file."},
                                  status=status.HTTP_400_BAD_REQUEST)
        return raw, None


class DonationCsvPreviewView(DonationCsvUploadView):
    """Authorize and inspect donation uploads without persisting proposed facts."""

    def post(self, request):
        raw, error = self.read_upload(request)
        if error:
            return error
        preview = parse_donation_csv(raw)
        # Only valid proposals are comparable. Name matching may decrypt saved
        # fields, so it must happen exclusively after finance authorization.
        # A future confirmation must recompute warnings, not trust this reply.
        preview["warnings"] = donation_duplicate_warnings(preview["proposed_records"])
        # Rows with errors are not a save capability, even if some other rows
        # were valid. Confirmation must revalidate the exact file independently.
        preview["review_token"] = (
            make_review_token(raw, preview, request.user.pk) if not preview["errors"] else None
        )
        return Response(preview, status=status.HTTP_200_OK)


class DonationCsvConfirmView(DonationCsvUploadView):
    """Reauthorize and revalidate a signed donation review before any write."""

    def post(self, request):
        raw, error = self.read_upload(request)
        if error:
            return error
        token = request.data.get("review_token")
        if not isinstance(token, str) or len(token) > 2048:
            return Response({"detail": "Review the CSV again before confirming."}, status=400)
        review, expired = read_review_token(token)
        if not review or review.get("user") != request.user.pk:
            return Response({"detail": "Review the CSV again before confirming."}, status=400)

        # Never trust browser proposals or a client-provided digest. Parse the
        # file again and compare exact bytes and normalized facts to the token.
        preview = parse_donation_csv(raw)
        if (preview["errors"] or review.get("file") != salted_hmac(
                "donation-csv-file.v1", raw,
        ).hexdigest()
                or review.get("fingerprint") != batch_fingerprint(preview["proposed_records"])):
            return Response({"detail": "CSV changed or is invalid. Review it again."}, status=400)
        fingerprint = review["fingerprint"]
        if expired:
            # Recovery is read-only; expiration cannot grant new save authority.
            batch = DonationImportBatch.objects.filter(fingerprint=fingerprint).first()
            if batch:
                return Response(batch_result(batch, already_imported=True))
            return Response({"detail": "Review expired. Upload the CSV again."}, status=400)

        acknowledged = request.data.get("acknowledge_warnings") == "true"
        try:
            result, failure = confirm_review(
                preview["proposed_records"], fingerprint, review.get("warnings"),
                acknowledged, request.user,
            )
        except (DatabaseError, EncryptedTextError, ImproperlyConfigured):
            # No uploaded facts, exception detail or database identifiers may
            # appear in a response/log. The atomic service has rolled back;
            # clients nevertheless retain the reviewed file for safe retry.
            logger.error("Unable to persist a donation CSV batch.")
            return Response({"detail": "Unable to confirm the import at this time."},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        if failure:
            return Response({"detail": failure}, status=409)
        return Response(result, status=status.HTTP_200_OK if result["already_imported"]
                        else status.HTTP_201_CREATED)
