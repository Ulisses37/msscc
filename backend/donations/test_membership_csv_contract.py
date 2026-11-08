import csv
from io import StringIO

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from donations.membership_csv_contract import (
    MAX_MEMBERSHIP_CSV_BYTES,
    MAX_MEMBERSHIP_CSV_ROWS,
    MEMBERSHIP_CSV_FIELD_LIMITS,
    MEMBERSHIP_CSV_HEADERS,
    MEMBERSHIP_CSV_PAYMENT_METHODS,
    MEMBERSHIP_CSV_PAYMENT_STATUSES,
    MEMBERSHIP_CSV_STATUSES,
    REQUIRED_MEMBERSHIP_CSV_FIELDS,
    membership_csv_manual_input,
    membership_csv_template,
)
from donations.models import Membership
from donations.serializers import ManualMembershipCreateSerializer


class MembershipCsvContractTests(TestCase):
    """Pin the header-only contract to the existing manual-entry rules."""

    def test_ordered_headers_and_excluded_server_fields(self):
        self.assertEqual(MEMBERSHIP_CSV_HEADERS, (
            "first_name", "last_name", "membership_type", "status", "email", "phone",
            "address", "membership_price", "amount_paid", "start_date", "end_date",
            "renewal_date", "payment_status", "payment_method", "reference_id", "notes",
        ))
        self.assertEqual(REQUIRED_MEMBERSHIP_CSV_FIELDS, MEMBERSHIP_CSV_HEADERS[:4])
        self.assertEqual(set(MEMBERSHIP_CSV_FIELD_LIMITS), set(MEMBERSHIP_CSV_HEADERS))
        self.assertEqual(len(set(MEMBERSHIP_CSV_HEADERS)), len(MEMBERSHIP_CSV_HEADERS))
        self.assertTrue(set(MEMBERSHIP_CSV_HEADERS).isdisjoint({
            "record_source", "membership_id", "stripe_payment_intent_id",
            "checkout_reference", "annual_history", "subscribe", "completed_at",
        }))

    def test_template_is_header_only_and_choices_follow_manual_validation(self):
        self.assertEqual(list(csv.reader(StringIO(membership_csv_template()))), [
            list(MEMBERSHIP_CSV_HEADERS),
        ])
        self.assertTrue(membership_csv_template().endswith("\r\n"))
        self.assertEqual(
            MEMBERSHIP_CSV_STATUSES, ManualMembershipCreateSerializer.MEMBERSHIP_STATUSES,
        )
        self.assertEqual(
            MEMBERSHIP_CSV_PAYMENT_STATUSES, ManualMembershipCreateSerializer.PAYMENT_STATUSES,
        )
        self.assertEqual(MEMBERSHIP_CSV_PAYMENT_METHODS, tuple(Membership.PaymentMethod.values))
        self.assertEqual(MAX_MEMBERSHIP_CSV_BYTES, 1_048_576)
        self.assertEqual(MAX_MEMBERSHIP_CSV_ROWS, 500)

    def test_blank_optional_values_and_known_zero_match_manual_rules(self):
        minimum = {
            "first_name": "Test", "last_name": "Member",
            "membership_type": "Historical", "status": "unknown",
        }
        blank_cells = {
            **minimum, **{key: "" for key in MEMBERSHIP_CSV_HEADERS[4:]},
        }
        normalized = membership_csv_manual_input(blank_cells)
        blank = ManualMembershipCreateSerializer(data=normalized)
        self.assertTrue(blank.is_valid(), blank.errors)
        for field in ("membership_price", "amount_paid", "start_date", "end_date",
                      "renewal_date", "payment_status", "payment_method"):
            self.assertIsNone(blank.validated_data[field])
        known = ManualMembershipCreateSerializer(data=membership_csv_manual_input({
            **minimum, "amount_paid": "0.00",
        }))
        self.assertTrue(known.is_valid(), known.errors)
        self.assertEqual(str(known.validated_data["amount_paid"]), "0.00")


class MembershipCsvTemplateEndpointTests(TestCase):
    """Prevent private admin downloads from bypassing financial permissions."""

    url = "/api/donations/memberships/import/template/"

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="template-admin@example.test", permissions_data={"Finances": True},
        )
        self.client = APIClient()

    def test_only_active_financial_admins_can_download_without_creating_records(self):
        self.assertEqual(self.client.get(self.url).status_code, 401)
        self.client.force_authenticate(user=self.user)
        for permissions, active in (({}, True), ({"Finances": False}, True),
                                    ({"Finances": True}, False)):
            self.user.permissions_data = permissions
            self.user.is_active = active
            self.assertEqual(self.client.get(self.url).status_code, 403)
        self.user.permissions_data = {"Finances": True}
        self.user.is_active = True
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content.decode("utf-8"), membership_csv_template())
        self.assertEqual(response["Content-Type"], "text/csv; charset=utf-8")
        self.assertEqual(response["Content-Disposition"],
                         'attachment; filename="membership-import-template.csv"')
        self.assertEqual(response["Cache-Control"], "no-store, private")
        self.assertFalse(Membership.objects.exists())
