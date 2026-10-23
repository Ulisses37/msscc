from datetime import UTC, date, datetime
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from rest_framework.test import APIClient

from config.encryption import EncryptedTextError, decrypt_text
from donations.models import Donation, Membership
from donations.services import update_membership_from_payment_intent
from payments.views import _update_donation_payment_status

DONATION_PII = {
    "donor_first_name": "松山 Jane",
    "donor_last_name": "O'Connor",
    "donor_email": "jane@example.test",
}
MEMBERSHIP_PII = {
    "first_name": "松山 Jane",
    "last_name": "O'Connor",
    "email": "jane@example.test",
    "phone": "555-0100",
}


class EncryptedPIIAPITests(TestCase):
    """Exercise the public contracts against encrypted storage and admin authorization."""

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="admin@example.test", is_staff=True, permissions_data={"Finances": True},
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.cases = (
            (Donation, "/api/donations/", DONATION_PII, {
                "amount": "10.00", "message": "Unchanged message", "is_anonymous": False,
            }),
            (Membership, "/api/donations/memberships/", MEMBERSHIP_PII, {
                "membership_type": "student", "amount_paid": "20.00",
                "start_date": "2026-10-21", "end_date": "2027-10-20",
                "renewal_date": "2027-10-21", "payment_status": "pending",
                "reference_id": "manual-reference", "status": "pending", "notes": "Keep notes",
            }),
        )

    def raw_values(self, record, fields):
        """Inspect isolated test storage without field decryption hooks."""
        quote = connection.ops.quote_name
        columns = ", ".join(quote(field) for field in fields)
        with connection.cursor() as cursor:
            cursor.execute(
                f"SELECT {columns} FROM {quote(record._meta.db_table)} "
                f"WHERE {quote(record._meta.pk.column)} = %s", [record.pk],
            )
            return dict(zip(fields, cursor.fetchone(), strict=True))

    def corrupt(self, record, field, value):
        """Simulate storage damage in the isolated SQLite database only."""
        quote = connection.ops.quote_name
        with connection.cursor() as cursor:
            cursor.execute(
                f"UPDATE {quote(record._meta.db_table)} SET {quote(field)} = %s "
                f"WHERE {quote(record._meta.pk.column)} = %s", [value, record.pk],
            )

    def assert_storage(self, record, pii):
        """Verify ciphertext storage and absence of legacy database columns."""
        with connection.cursor() as cursor:
            columns = {
                column.name for column in connection.introspection.get_table_description(
                    cursor, record._meta.db_table,
                )
            }
        for field, expected in pii.items():
            self.assertNotIn(field, columns)
            raw = self.raw_values(record, [f"{field}_encrypted"])
            ciphertext = raw[f"{field}_encrypted"]
            self.assertTrue(ciphertext.startswith("msscc:enc:v1:"))
            self.assertNotEqual(ciphertext, expected)
            self.assertEqual(decrypt_text(ciphertext), expected)

    def test_creation_retains_contract_and_stores_only_encrypted_pii(self):
        for model, url, pii, other in self.cases:
            with self.subTest(model=model.__name__):
                with self.assertNoLogs("donations", level="DEBUG"):
                    response = self.client.post(url, {**pii, **other}, format="json")
                self.assertEqual(response.status_code, 201)
                record = model.objects.get()
                self.assert_storage(record, pii)
                for field, expected in pii.items():
                    self.assertEqual(response.data[field], expected)
                self.assertFalse(any(key.endswith("_encrypted") for key in response.data))
                self.assertNotIn("msscc:enc:", str(response.data))
                self.assertNotIn("Jane", str(record))

    def test_partial_and_full_updates_encrypt_pii_and_preserve_other_fields(self):
        for model, url, pii, other in self.cases:
            response = self.client.post(url, {**pii, **other}, format="json")
            self.assertEqual(response.status_code, 201)
            record = model.objects.get()
            detail = f"{url}{record.pk}/"
            for method in ("patch", "put"):
                updated = {field: f"Updated {value}" for field, value in pii.items()}
                email_field = "donor_email" if model is Donation else "email"
                updated[email_field] = f"{method}@example.test"
                payload = updated if method == "patch" else {**other, **updated}
                with self.assertNoLogs("donations", level="DEBUG"):
                    response = getattr(self.client, method)(detail, payload, format="json")
                self.assertEqual(response.status_code, 200)
                self.assert_storage(record, updated)
                for field, value in other.items():
                    self.assertEqual(response.data[field], value)
                for field, value in updated.items():
                    self.assertEqual(response.data[field], value)

    def test_existing_encrypted_records_serialize_from_encrypted_fields(self):
        for model, url, pii, other in self.cases:
            values = {**{f"{field}_encrypted": value for field, value in pii.items()}, **other}
            if model is Donation:
                values.update(donation_date=date(2026, 10, 21), reference_id="DON-00000001")
            record = model.objects.create(**values)
            for endpoint in (url, f"{url}{record.pk}/"):
                response = self.client.get(endpoint)
                self.assertEqual(response.status_code, 200)
                result = response.data[0] if endpoint == url else response.data
                for field, expected in pii.items():
                    self.assertEqual(result[field], expected)

    def test_email_filter_matches_decrypted_values_case_insensitively(self):
        for model, url, pii, other in self.cases:
            self.client.post(url, {**pii, **other}, format="json")
            email = "donor_email" if model is Donation else "email"
            for query, count in ((pii[email].upper(), 1), ("other@example.test", 0)):
                response = self.client.get(url, {email: query})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(len(response.data), count)

    def test_authorization_precedes_pii_loading(self):
        for model, url, pii, other in self.cases:
            self.client.post(url, {**pii, **other}, format="json")
            record = model.objects.get()
            self.corrupt(record, f"{next(iter(pii))}_encrypted", "damaged")
            for authenticated in (False, True):
                client = APIClient()
                if authenticated:
                    self.user.permissions_data = {"Finances": False}
                    client.force_authenticate(user=self.user)
                for method, endpoint in (
                    ("get", url), ("get", f"{url}{record.pk}/"),
                    ("patch", f"{url}{record.pk}/"), ("delete", f"{url}{record.pk}/"),
                ):
                    response = getattr(client, method)(endpoint)
                    self.assertEqual(response.status_code, 403 if authenticated else 401)
            self.user.permissions_data = {"Finances": True}

    def test_malformed_and_tampered_ciphertext_fail_without_disclosure(self):
        for model, url, pii, other in self.cases:
            self.client.post(url, {**pii, **other}, format="json")
            record = model.objects.get()
            field = f"{next(iter(pii))}_encrypted"
            token = self.raw_values(record, [field])[field]
            for damaged in (
                "plaintext-in-storage", "msscc:enc:v2:invalid", token[:-8] + "AAAAAAAA",
            ):
                self.corrupt(record, field, damaged)
                for method, endpoint in (
                    ("get", url), ("get", f"{url}{record.pk}/"),
                    ("patch", f"{url}{record.pk}/"), ("delete", f"{url}{record.pk}/"),
                ):
                    with self.assertLogs("donations.views", level="ERROR") as logs:
                        response = getattr(self.client, method)(endpoint)
                    self.assertEqual(response.status_code, 503)
                    self.assertEqual(response.data, {
                        "detail": "Record processing is temporarily unavailable.",
                    })
                    exposed = str(response.data) + str(logs.output)
                    for sensitive in (damaged, *pii.values(), *settings.FIELD_ENCRYPTION_KEYS):
                        self.assertNotIn(sensitive, exposed)
                    self.assertTrue(all(log.exc_info is None for log in logs.records))

    def test_encryption_failure_rolls_back_creation_and_update(self):
        for model, url, pii, other in self.cases:
            with patch("config.fields.encrypt_text", side_effect=EncryptedTextError("private")):
                with self.assertLogs("donations.views", level="ERROR") as logs:
                    response = self.client.post(url, {**pii, **other}, format="json")
            self.assertEqual(response.status_code, 503)
            self.assertFalse(model.objects.exists())
            self.assertNotIn("private", str(response.data) + str(logs.output))
            self.client.post(url, {**pii, **other}, format="json")
            record = model.objects.get()
            before = self.raw_values(record, [f"{field}_encrypted" for field in pii])
            with patch("config.fields.encrypt_text", side_effect=EncryptedTextError("private")):
                with self.assertLogs("donations.views", level="ERROR"):
                    response = self.client.patch(
                        f"{url}{record.pk}/", {next(iter(pii)): "New name"}, format="json",
                    )
            self.assertEqual(response.status_code, 503)
            self.assertEqual(self.raw_values(record, list(before)), before)

    def test_donation_creation_remains_public_but_manual_membership_does_not(self):
        client = APIClient()
        for model, url, pii, other in self.cases:
            response = client.post(url, {**pii, **other}, format="json")
            self.assertEqual(response.status_code, 201 if model is Donation else 401)

    @patch("donations.services.create_membership_payment_intent")
    def test_membership_checkout_and_activation_preserve_encrypted_storage(self, create_intent):
        create_intent.return_value = {
            "session_id": "pi_test_encryption", "client_secret": "test-client-secret",
        }
        with self.assertNoLogs("donations", level="DEBUG"):
            response = APIClient().post("/api/payments/membership/session/", {
                **MEMBERSHIP_PII, "membership_option_id": "student",
                "payment_purpose": "membership",
            }, format="json")
        self.assertEqual(response.status_code, 201)
        record = Membership.objects.get()
        self.assert_storage(record, MEMBERSHIP_PII)
        fields = [f"{field}_encrypted" for field in MEMBERSHIP_PII]
        before = self.raw_values(record, fields)
        create_intent.assert_called_once_with(
            amount=20, membership_option_id="student", internal_reference=record.checkout_reference,
        )
        self.assertEqual(record.stripe_payment_intent_id, "pi_test_encryption")
        self.assertEqual(record.reference_id, response.data["confirmation_reference"])
        self.assertEqual(record.payment_status, "pending")
        self.assertEqual(record.amount_paid, 0)
        self.assertTrue(update_membership_from_payment_intent(
            reference=record.checkout_reference, intent_id=record.stripe_payment_intent_id,
            event_type="payment_intent.succeeded", event_created=1792584000,
            intent={"status": "succeeded", "amount_received": 2000, "currency": "usd"},
        ))
        record.refresh_from_db()
        self.assertEqual(record.payment_status, "completed")
        self.assertEqual(record.status, "active")
        self.assertEqual(record.amount_paid, 20)
        self.assertEqual(self.raw_values(record, fields), before)
        self.assertEqual(record.stripe_payment_intent_id, "pi_test_encryption")
        self.assertEqual(record.checkout_reference, response.data["confirmation_reference"])

    def test_payment_only_operations_do_not_decrypt_or_rewrite_pii(self):
        for model, url, pii, other in self.cases:
            self.client.post(url, {**pii, **other}, format="json")
            record = model.objects.get()
            if model is Membership:
                model.objects.filter(pk=record.pk).update(
                    checkout_reference="MEM-" + "a" * 32,
                    stripe_payment_intent_id="pi_test_damaged_pii",
                    expected_amount=20, currency="usd", membership_option_id="student",
                )
                record.refresh_from_db()
                reference = record.checkout_reference
            else:
                reference = record.reference_id
            field = f"{next(iter(pii))}_encrypted"
            self.corrupt(record, field, "msscc:enc:v1:damaged")
            fields = [f"{name}_encrypted" for name in pii]
            before = self.raw_values(record, fields)
            with patch("config.fields.decrypt_text", side_effect=AssertionError("PII loaded")):
                if model is Donation:
                    self.assertTrue(_update_donation_payment_status(reference, "completed"))
                else:
                    self.assertTrue(update_membership_from_payment_intent(
                        reference=reference, intent_id=record.stripe_payment_intent_id,
                        event_type="payment_intent.succeeded", event_created=1792584000,
                        intent={"status": "succeeded", "amount_received": 2000, "currency": "usd"},
                    ))
                    response = APIClient().get(
                        "/api/payments/membership/status/", {"confirmation_reference": reference},
                    )
                    self.assertEqual(response.status_code, 200)
                model.objects.filter(pk=record.pk).update(
                    completed_at=datetime(2026, 10, 21, tzinfo=UTC),
                )
                response = APIClient().get(
                    "/api/payments/receipt/", {"confirmation_reference": reference},
                )
            self.assertEqual(response.status_code, 200)
            self.assertNotIn("msscc:enc:", str(response.data))
            for value in pii.values():
                self.assertNotIn(value, str(response.data))
            self.assertEqual(self.raw_values(record, fields), before)

    @patch("donations.services.create_membership_payment_intent")
    def test_checkout_encryption_failure_is_safe_and_never_calls_stripe(self, create_intent):
        with patch("config.fields.encrypt_text", side_effect=EncryptedTextError("private")):
            with self.assertLogs("payments.views", level="ERROR") as logs:
                response = APIClient().post("/api/payments/membership/session/", {
                    **MEMBERSHIP_PII, "membership_option_id": "student",
                    "payment_purpose": "membership",
                }, format="json")
        self.assertEqual(response.status_code, 502)
        self.assertFalse(Membership.objects.exists())
        create_intent.assert_not_called()
        exposed = str(response.data) + str(logs.output)
        for sensitive in ("private", *MEMBERSHIP_PII.values(), *settings.FIELD_ENCRYPTION_KEYS):
            self.assertNotIn(sensitive, exposed)

