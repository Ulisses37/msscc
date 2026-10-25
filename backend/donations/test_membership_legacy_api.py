from decimal import Decimal
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connection, models
from django.db.models.functions import Cast
from django.test import TestCase
from rest_framework.test import APIClient

from config.encryption import EncryptedTextError, decrypt_text, encrypt_text
from donations.models import Membership
from donations.serializers import MembershipSerializer

MEMBERSHIP_URL = "/api/donations/memberships/"
NULLABLE_FIELDS = (
    "email", "phone", "amount_paid", "payment_status", "start_date", "end_date", "renewal_date",
)


class MembershipLegacyAPITests(TestCase):
    """Exercise legacy-compatible membership data through authorized API boundaries."""

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="finance@example.test", is_staff=True, permissions_data={"Finances": True},
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def membership_data(self, **overrides):
        """Build the existing manual-create contract with explicit unknown facts."""
        data = {
            "first_name": "Maya", "last_name": "Chen", "membership_type": "individual",
            "reference_id": "historical-reference", "status": "active", "notes": "Historical",
            **dict.fromkeys(NULLABLE_FIELDS),
        }
        data.update(overrides)
        return data

    def create_membership(self, **overrides):
        """Create a membership through the authorized manual endpoint."""
        response = self.client.post(
            MEMBERSHIP_URL, self.membership_data(**overrides), format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return Membership.objects.get(pk=response.data["membership_id"])

    def detail_url(self, member):
        """Return the existing membership detail route."""
        return f"{MEMBERSHIP_URL}{member.pk}/"

    def stored_address(self, member):
        """Read ciphertext without the encrypted field's conversion hook."""
        return Membership.objects.annotate(
            stored=Cast("address_encrypted", output_field=models.TextField()),
        ).values_list("stored", flat=True).get(pk=member.pk)

    def test_null_fields_round_trip_on_create_list_and_detail(self):
        response = self.client.post(MEMBERSHIP_URL, self.membership_data(), format="json")
        self.assertEqual(response.status_code, 201)
        member = Membership.objects.get(pk=response.data["membership_id"])
        for data in (
            response.data, self.client.get(MEMBERSHIP_URL).data[0],
            self.client.get(self.detail_url(member)).data,
        ):
            for field in (*NULLABLE_FIELDS, "address", "membership_price"):
                self.assertIsNone(data[field], field)
            self.assertEqual(data["record_source"], "manual")
        self.assertIsNone(member.amount_paid)
        self.assertIsNone(member.payment_status)

    def test_explicit_null_updates_clear_known_values(self):
        member = self.create_membership(
            email="maya@example.test", phone="555-0100", amount_paid="20.00",
            payment_status="paid by check", start_date="2020-01-01", end_date="2020-12-31",
            renewal_date="2021-01-01", address="123 Example Street", membership_price="35.00",
        )
        response = self.client.patch(
            self.detail_url(member),
            dict.fromkeys((*NULLABLE_FIELDS, "address", "membership_price")), format="json",
        )
        self.assertEqual(response.status_code, 200)
        for field in (*NULLABLE_FIELDS, "address", "membership_price"):
            self.assertIsNone(response.data[field])
        self.assertIsNone(self.stored_address(member))

    def test_existing_create_fields_remain_required_when_omitted(self):
        for field in NULLABLE_FIELDS:
            with self.subTest(field=field):
                data = self.membership_data()
                data.pop(field)
                serializer = MembershipSerializer(data=data)
                self.assertFalse(serializer.is_valid())
                self.assertIn(field, serializer.errors)

    def test_zero_and_expected_dues_remain_distinct_from_unknown_payments(self):
        member = self.create_membership(amount_paid="0.00", membership_price="35.25")
        self.assertEqual(member.amount_paid, Decimal("0.00"))
        self.assertEqual(member.membership_price, Decimal("35.25"))
        response = self.client.patch(
            self.detail_url(member), {"amount_paid": None}, format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["amount_paid"])
        self.assertEqual(response.data["membership_price"], "35.25")
        self.assertIsNone(response.data["payment_status"])

    def test_membership_price_rejects_invalid_currency_precision_and_size(self):
        for value in ("35.251", "100000000.00", "invalid", True):
            with self.subTest(value=value):
                response = self.client.post(
                    MEMBERSHIP_URL, self.membership_data(membership_price=value), format="json",
                )
                self.assertEqual(response.status_code, 400)
                self.assertIn("membership_price", response.data)
        self.assertFalse(Membership.objects.exists())

    def test_authorized_address_reads_are_plaintext_and_storage_is_ciphertext(self):
        address = "123 Example Street\n松山市, 日本"
        member = self.create_membership(address=address)
        ciphertext = self.stored_address(member)
        self.assertTrue(ciphertext.startswith("msscc:enc:v1:"))
        self.assertNotEqual(ciphertext, address)
        self.assertEqual(decrypt_text(ciphertext), address)
        for data in (
            self.client.get(MEMBERSHIP_URL).data[0],
            self.client.get(self.detail_url(member)).data,
        ):
            self.assertEqual(data["address"], address)
            self.assertNotIn("address_encrypted", data)
            self.assertNotIn(ciphertext, str(data))
            self.assertNotIn("stripe_payment_intent_id", data)
            self.assertNotIn("checkout_reference", data)

    def test_address_patch_preserves_omitted_value_and_encrypts_replacement(self):
        member = self.create_membership(address="Original address")
        response = self.client.patch(self.detail_url(member), {"notes": "Changed"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["address"], "Original address")
        response = self.client.patch(
            self.detail_url(member), {"address": "New address\n日本"}, format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(decrypt_text(self.stored_address(member)), "New address\n日本")

    def test_blank_addresses_become_database_null_on_create_and_update(self):
        for address in ("", " \t\n ", None):
            with self.subTest(address=address):
                member = self.create_membership(address=address)
                self.assertIsNone(self.stored_address(member))
                self.client.patch(
                    self.detail_url(member), {"address": "Known address"}, format="json",
                )
                response = self.client.patch(
                    self.detail_url(member), {"address": address}, format="json",
                )
                self.assertEqual(response.status_code, 200)
                self.assertIsNone(response.data["address"])
                self.assertIsNone(self.stored_address(member))

    def test_non_text_address_input_is_rejected(self):
        for address in ({"street": "Example"}, ["Example"], True, 123, 1.5):
            with self.subTest(address=address):
                response = self.client.post(
                    MEMBERSHIP_URL, self.membership_data(address=address), format="json",
                )
                self.assertEqual(response.status_code, 400)
                self.assertIn("address", response.data)
        self.assertFalse(Membership.objects.exists())

    def test_client_cannot_assign_record_source_on_create_or_update(self):
        for source in ("legacy_import", "checkout", "arbitrary", None):
            with self.subTest(source=source):
                member = self.create_membership(record_source=source)
                self.assertEqual(member.record_source, "manual")
                response = self.client.patch(
                    self.detail_url(member), {"record_source": source}, format="json",
                )
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data["record_source"], "manual")

    def test_trusted_backend_can_assign_legacy_source_and_updates_preserve_it(self):
        serializer = MembershipSerializer(data=self.membership_data())
        self.assertTrue(serializer.is_valid(), serializer.errors)
        member = serializer.save(record_source=Membership.RecordSource.LEGACY_IMPORT)
        response = self.client.patch(
            self.detail_url(member), {"notes": "Edited", "record_source": "manual"}, format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["record_source"], "legacy_import")
        member.refresh_from_db()
        self.assertEqual(member.record_source, "legacy_import")

    @patch("donations.services.create_membership_payment_intent")
    def test_public_checkout_assigns_checkout_source(self, create_intent):
        create_intent.return_value = {"session_id": "pi_test_legacy_api"}
        response = APIClient().post("/api/payments/membership/session/", {
            "first_name": "Maya", "last_name": "Chen", "email": "maya@example.test",
            "membership_option_id": "student", "payment_purpose": "membership",
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        member = Membership.objects.get()
        self.assertEqual(member.record_source, "checkout")
        response = self.client.patch(
            self.detail_url(member), {"record_source": "manual"}, format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["record_source"], "checkout")

    def test_address_access_is_denied_before_decryption_for_unauthorized_callers(self):
        member = self.create_membership(address="Private address")
        for authenticated in (False, True):
            self.client.force_authenticate(user=self.user if authenticated else None)
            self.user.permissions_data = {}
            with patch("config.fields.decrypt_text", side_effect=AssertionError("PII loaded")):
                for url in (MEMBERSHIP_URL, self.detail_url(member)):
                    response = self.client.get(url)
                    self.assertEqual(response.status_code, 403 if authenticated else 401)
                    self.assertNotIn("Private address", str(response.data))

    def test_damaged_address_ciphertext_fails_safely_without_disclosure(self):
        address = "Private address 日本"
        member = self.create_membership(address=address)
        ciphertext = encrypt_text(address)
        tampered = ciphertext[:-5] + ("A" if ciphertext[-5] != "A" else "B") + ciphertext[-4:]
        for damaged in ("plaintext-not-ciphertext", "msscc:enc:v1:damaged", tampered):
            # Storage damage is simulated only inside the isolated SQLite test database.
            with connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE donations_membership SET address_encrypted = %s "
                    "WHERE membership_id = %s", [damaged, member.pk],
                )
            for method, url in (
                ("get", MEMBERSHIP_URL), ("get", self.detail_url(member)),
                ("patch", self.detail_url(member)),
            ):
                with self.subTest(damaged=damaged, method=method, url=url):
                    with self.assertLogs("donations.views", level="ERROR") as logs:
                        response = getattr(self.client, method)(url, {}, format="json")
                    self.assertEqual(response.status_code, 503)
                    self.assertEqual(response.data, {
                        "detail": "Record processing is temporarily unavailable.",
                    })
                    exposed = str(response.data) + str(logs.output)
                    for private in (address, damaged, ciphertext, *settings.FIELD_ENCRYPTION_KEYS):
                        self.assertNotIn(private, exposed)
                    self.assertTrue(all(record.exc_info is None for record in logs.records))

    def test_address_encryption_failure_is_controlled_and_does_not_create_record(self):
        with patch("config.fields.encrypt_text", side_effect=EncryptedTextError("private-detail")):
            with self.assertLogs("donations.views", level="ERROR") as logs:
                response = self.client.post(
                    MEMBERSHIP_URL, self.membership_data(address="Private address"), format="json",
                )
        self.assertEqual(response.status_code, 503)
        self.assertFalse(Membership.objects.exists())
        exposed = str(response.data) + str(logs.output)
        self.assertNotIn("private-detail", exposed)
        self.assertNotIn("Private address", exposed)
