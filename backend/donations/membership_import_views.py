from django.http import HttpResponse
from django.utils.crypto import salted_hmac
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from donations.membership_csv_confirmation import (
    batch_fingerprint,
    batch_result,
    confirm_review,
    make_review_token,
    read_review_token,
)
from donations.membership_csv_contract import MAX_MEMBERSHIP_CSV_BYTES, membership_csv_template
from donations.membership_csv_duplicates import membership_duplicate_warnings
from donations.membership_csv_preview import parse_membership_csv
from donations.models import MembershipImportBatch
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


class MembershipCsvUploadView(APIView):
    """Share bounded, finance-authorized upload handling between preview and confirmation."""

    permission_classes = [HasFinancialRecordPermission]
    parser_classes = [MultiPartParser]

    def finalize_response(self, request, response, *args, **kwargs):
        """Private proposed contacts must not be cached by a browser or intermediary."""
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store, private"
        return response

    def read_upload(self, request):
        """Read no more than the contracted size plus one byte from the upload."""
        upload = request.FILES.get("file")
        if upload is None or len(request.FILES) != 1:
            return None, Response({"detail": "Provide one membership CSV file in the file field."},
                                  status=status.HTTP_400_BAD_REQUEST)
        if upload.size > MAX_MEMBERSHIP_CSV_BYTES:
            return None, Response({"detail": "CSV must be at most 1,048,576 bytes."},
                                  status=status.HTTP_400_BAD_REQUEST)
        try:
            raw = upload.read(MAX_MEMBERSHIP_CSV_BYTES + 1)
        except OSError:
            return None, Response({"detail": "Unable to read the CSV file."},
                                  status=status.HTTP_400_BAD_REQUEST)
        return raw, None


class MembershipCsvPreviewView(MembershipCsvUploadView):
    """Authorize and validate membership CSVs; never persist preview data."""

    def post(self, request):
        raw, error = self.read_upload(request)
        if error:
            return error
        preview = parse_membership_csv(raw)
        # Only validated rows can be compared; errors still block later confirmation.
        # Duplicate lookup runs exclusively inside this finance-authorized view:
        # it may decrypt saved names, which must never be queried for an outsider.
        # This is still read-only; a later save must recompute these warnings.
        preview["warnings"] = membership_duplicate_warnings(preview["proposed_records"])
        # Invalid batches cannot be confirmed; do not issue them a save capability.
        preview["review_token"] = (
            make_review_token(raw, preview, request.user.pk) if not preview["errors"] else None
        )
        return Response(preview, status=status.HTTP_200_OK)


class MembershipCsvConfirmView(MembershipCsvUploadView):
    """Independently authorize and revalidate a reviewed CSV before any writes."""

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

        # Parse and validate again: neither proposals nor file hashes supplied
        # by a browser are authority to create financial records.
        preview = parse_membership_csv(raw)
        if (preview["errors"] or review.get("file") != salted_hmac(
                "membership-csv-file.v1", raw,
        ).hexdigest()
                or review.get("fingerprint") != batch_fingerprint(preview["proposed_records"])):
            return Response({"detail": "CSV changed or is invalid. Review it again."}, status=400)
        fingerprint = review["fingerprint"]
        if expired:
            # An expired token can ONLY retrieve an already committed batch.
            # It cannot authorize a new import, even with identical file bytes.
            batch = MembershipImportBatch.objects.filter(fingerprint=fingerprint).first()
            if batch:
                return Response(batch_result(batch, already_imported=True))
            return Response({"detail": "Review expired. Upload the CSV again."}, status=400)

        acknowledged = request.data.get("acknowledge_warnings") == "true"
        result, failure = confirm_review(
            preview["proposed_records"], fingerprint, review.get("warnings"),
            acknowledged, request.user,
        )
        if failure:
            return Response({"detail": failure}, status=409)
        return Response(result, status=status.HTTP_200_OK if result["already_imported"]
                        else status.HTTP_201_CREATED)
