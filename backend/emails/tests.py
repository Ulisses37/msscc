import ast
import base64
import hashlib
import hmac
import json
import pathlib
import time
from datetime import timedelta
from unittest.mock import patch

import resend
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.db import DatabaseError, IntegrityError, transaction
from django.template.loader import render_to_string
from django.test import TestCase, override_settings
from django.utils import timezone
from resend.exceptions import ResendError
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from emails.models import CONFIRMATION_RESEND_COOLDOWN, CONFIRMATION_TOKEN_TTL, Subscriber
from emails.providers import ContactState, ProviderError, get_provider
from emails.providers.base import EmailProvider
from emails.providers.resend import UNSUBSCRIBE_URL_PLACEHOLDER, ResendProvider
from emails.services import send_email
from emails.subscribers import subscribe_contact
from emails.views import SUBSCRIBE_RESPONSE

User = get_user_model()


class ProviderSelectionTests(TestCase):
    """The configured EMAIL_PROVIDER names the adapter that gets used."""

    def test_default_provider_is_resend(self):
        with override_settings(EMAIL_PROVIDER="resend"):
            self.assertIsInstance(get_provider(), ResendProvider)

    def test_unknown_provider_is_rejected(self):
        with override_settings(EMAIL_PROVIDER="does-not-exist"):
            with self.assertRaises(ImproperlyConfigured):
                get_provider()

    def test_adapter_implements_the_interface(self):
        self.assertIsInstance(ResendProvider(), EmailProvider)


class ResendImportGuardTests(TestCase):
    """Only the provider package may import the Resend SDK.

    This is the story's acceptance criterion: swapping providers must require
    nothing beyond a new adapter and an EMAIL_PROVIDER change.
    """

    def test_no_resend_import_outside_the_adapter(self):
        backend_root = pathlib.Path(__file__).resolve().parent.parent
        allowed = {
            backend_root / "emails" / "providers",
            backend_root / "emails" / "tests.py",
        }
        offenders = []
        for path in backend_root.rglob("*.py"):
            if "venv" in path.parts or "__pycache__" in path.parts:
                continue
            if path in allowed or backend_root / "emails" / "providers" in path.parents:
                continue
            source = path.read_text(encoding="utf-8")
            if "import resend" in source or "from resend" in source:
                offenders.append(str(path.relative_to(backend_root)))

        self.assertEqual(offenders, [])

    def test_resend_adapter_module_imports_the_sdk(self):
        adapter = pathlib.Path(__file__).resolve().parent / "providers" / "resend.py"
        self.assertIn("import resend", adapter.read_text(encoding="utf-8"))


class ProviderLayeringGuardTests(TestCase):
    """Only the provider package may import a concrete adapter.

    ``emails.providers.resend`` is the adapter itself: importing it anywhere
    outside the package would load the Resend SDK unconditionally and defeat the
    lazy lookup in ``get_provider()``. ``emails.providers.resend_webhook`` is the
    one deliberate exception: it is the integration point for Resend's webhook,
    so it has to be reachable from the URL configuration. It must not be used by
    any other module.
    """

    ADAPTER_MODULE = "emails.providers.resend"
    WEBHOOK_MODULE = "emails.providers.resend_webhook"
    # urls.py imports from views, not from the webhook module, so only views is
    # allowed to name it.
    WEBHOOK_ALLOWED_IMPORTERS = {"emails/views.py"}

    def _imported_modules(self, path):
        modules = set()
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if isinstance(node, ast.Import):
                modules.update(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                modules.add(node.module)
        return modules

    def _scan(self, forbidden_module, allowed_importers=frozenset()):
        backend_root = pathlib.Path(__file__).resolve().parent.parent
        offenders = []
        for path in backend_root.rglob("*.py"):
            if "venv" in path.parts or "__pycache__" in path.parts:
                continue
            if backend_root / "emails" / "providers" in path.parents:
                continue
            relative = str(path.relative_to(backend_root)).replace("\\", "/")
            if path == pathlib.Path(__file__).resolve():
                continue
            if relative in allowed_importers:
                continue
            if forbidden_module in self._imported_modules(path):
                offenders.append(relative)

        return offenders

    def test_no_module_imports_the_resend_adapter_directly(self):
        self.assertEqual(self._scan(self.ADAPTER_MODULE), [])

    def test_only_views_and_urls_import_the_resend_webhook_module(self):
        self.assertEqual(
            self._scan(self.WEBHOOK_MODULE, self.WEBHOOK_ALLOWED_IMPORTERS),
            [],
        )


class SubscribeContactImportGuardTests(TestCase):
    """Joining the mailing list must stay independent of any payment concept."""

    def test_service_does_not_import_payment_modules(self):
        tree = ast.parse(
            (pathlib.Path(__file__).resolve().parent / "subscribers.py").read_text(
                encoding="utf-8"
            )
        )

        imported = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported.update(alias.name.split(".")[0] for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported.add(node.module.split(".")[0])

        for forbidden in ("stripe", "payments", "donations"):
            self.assertNotIn(forbidden, imported)


class SubscribeContactServiceTests(TestCase):
    """subscribe_contact records intent and sends a confirmation link."""

    def patch_mailer(self):
        return patch("emails.subscribers.send_subscription_confirmation_email")

    def test_creates_a_pending_subscriber_and_sends_a_confirmation(self):
        with self.patch_mailer() as mailer:
            subscriber = subscribe_contact("  Member@Example.Test ", Subscriber.Source.DONATION)

        self.assertEqual(subscriber.email, "member@example.test")
        self.assertEqual(subscriber.source, Subscriber.Source.DONATION)
        # Signing up records intent only; the row is not subscribed until the
        # address confirms from its own inbox.
        self.assertEqual(subscriber.status, Subscriber.Status.PENDING)
        mailer.assert_called_once()
        self.assertEqual(mailer.call_args.args[0], "member@example.test")

    def test_stored_token_is_a_hash_and_is_not_the_raw_value(self):
        with self.patch_mailer() as mailer:
            subscriber = subscribe_contact("member@example.test", Subscriber.Source.FOOTER)

        raw_token = mailer.call_args.args[1]
        subscriber.refresh_from_db()
        # The raw value only ever exists in the email, never in the database.
        self.assertNotEqual(subscriber.confirmation_token_hash, raw_token)
        self.assertEqual(
            subscriber.confirmation_token_hash,
            hashlib.sha256(raw_token.encode()).hexdigest(),
        )
        self.assertEqual(len(subscriber.confirmation_token_hash), 64)

    def test_confirmation_expires_forty_eight_hours_after_it_is_sent(self):
        with self.patch_mailer():
            subscriber = subscribe_contact("member@example.test", Subscriber.Source.FOOTER)

        subscriber.refresh_from_db()
        self.assertIsNotNone(subscriber.confirmation_sent_at)
        self.assertEqual(
            subscriber.confirmation_expires_at - subscriber.confirmation_sent_at,
            CONFIRMATION_TOKEN_TTL,
        )

    def test_no_contact_is_created_in_the_provider(self):
        with self.patch_mailer():
            with patch("emails.providers.get_provider") as get_provider_mock:
                subscribe_contact("member@example.test", Subscriber.Source.FOOTER)

        # Only the confirm step may create a provider contact.
        get_provider_mock.assert_not_called()


    def test_repeat_signup_inside_the_cooldown_sends_one_email(self):
        with self.patch_mailer() as mailer:
            subscribe_contact("member@example.test", Subscriber.Source.FOOTER)
            subscribe_contact("member@example.test", Subscriber.Source.FOOTER)

        self.assertEqual(Subscriber.objects.count(), 1)
        # A repeated public POST must not be a way to re-send mail on demand.
        self.assertEqual(mailer.call_count, 1)

    def test_signup_past_the_cooldown_sends_a_new_link(self):
        with self.patch_mailer() as mailer:
            subscribe_contact("member@example.test", Subscriber.Source.FOOTER)
            first_hash = Subscriber.objects.get(
                email="member@example.test"
            ).confirmation_token_hash

            row = Subscriber.objects.get(email="member@example.test")
            row.confirmation_sent_at = timezone.now() - CONFIRMATION_RESEND_COOLDOWN
            row.save(update_fields=["confirmation_sent_at"])

            subscribe_contact("member@example.test", Subscriber.Source.FOOTER)

        self.assertEqual(mailer.call_count, 2)
        # Issuing a new token replaces the old hash, so the earlier link dies.
        current_hash = Subscriber.objects.get(
            email="member@example.test"
        ).confirmation_token_hash
        self.assertNotEqual(current_hash, first_hash)

    def test_subscribed_row_is_sent_nothing(self):
        Subscriber.objects.create(
            email="member@example.test",
            source=Subscriber.Source.FOOTER,
            status=Subscriber.Status.SUBSCRIBED,
        )

        with self.patch_mailer() as mailer:
            subscribe_contact("member@example.test", Subscriber.Source.DONATION)

        # Already confirmed, so there is nothing to confirm again.
        mailer.assert_not_called()
        subscriber = Subscriber.objects.get(email="member@example.test")
        self.assertIsNone(subscriber.confirmation_sent_at)

    def test_unsubscribed_row_stays_unsubscribed_and_is_sent_a_new_confirmation(self):
        original_time = timezone.now() - timedelta(days=30)
        Subscriber.objects.create(
            email="gone@example.test",
            source=Subscriber.Source.FOOTER,
            status=Subscriber.Status.UNSUBSCRIBED,
            unsubscribed_at=original_time,
        )

        with self.patch_mailer() as mailer:
            subscribe_contact("gone@example.test", Subscriber.Source.DONATION)

        # An address that left may come back, but only by confirming from its
        # own inbox, so the opt-out stands until the confirm step runs.
        mailer.assert_called_once()
        subscriber = Subscriber.objects.get(email="gone@example.test")
        self.assertEqual(subscriber.status, Subscriber.Status.UNSUBSCRIBED)
        self.assertEqual(subscriber.unsubscribed_at, original_time)
        self.assertEqual(subscriber.source, Subscriber.Source.FOOTER)
        # The row is not left untouched: a fresh token was issued for the link.
        self.assertEqual(
            subscriber.confirmation_token_hash,
            hashlib.sha256(mailer.call_args.args[1].encode()).hexdigest(),
        )
        self.assertIsNotNone(subscriber.confirmation_sent_at)
        self.assertIsNotNone(subscriber.confirmation_expires_at)

    def test_misconfiguration_does_not_break_the_saved_signup(self):
        # A bad EMAIL_PROVIDER must not turn a saved signup into a 500. The real
        # mailer path runs here, and send_email swallows the failure.
        with override_settings(EMAIL_PROVIDER="does-not-exist"):
            subscriber = subscribe_contact("member@example.test", Subscriber.Source.FOOTER)

        self.assertIsNotNone(subscriber.pk)
        subscriber.refresh_from_db()
        self.assertEqual(subscriber.status, Subscriber.Status.PENDING)
        # The token is still recorded, so a developer can read the row.
        self.assertIsNotNone(subscriber.confirmation_sent_at)

    def test_provider_failure_does_not_break_the_saved_signup(self):
        # A failure inside the send must never reach the caller, because this is
        # a public endpoint and the row is already written.
        with patch("emails.subscribers.send_subscription_confirmation_email") as mailer:
            mailer.side_effect = ProviderError("down")
            subscriber = subscribe_contact("member@example.test", Subscriber.Source.FOOTER)

        self.assertEqual(subscriber.status, Subscriber.Status.PENDING)
        subscriber.refresh_from_db()
        self.assertEqual(subscriber.status, Subscriber.Status.PENDING)
        # The token is still recorded, so the link can be re-issued later.
        self.assertIsNotNone(subscriber.confirmation_sent_at)

    def test_integrity_error_during_create_falls_back_to_the_existing_row(self):
        Subscriber.objects.create(
            email="racer@example.test",
            source=Subscriber.Source.FOOTER,
            status=Subscriber.Status.PENDING,
            confirmation_sent_at=timezone.now(),
        )

        # Simulate losing the get_or_create race: the insert fails even though
        # the lookup found nothing, because the other request committed first.
        with patch.object(Subscriber.objects, "get_or_create", side_effect=IntegrityError):
            with self.patch_mailer() as mailer:
                subscriber = subscribe_contact("racer@example.test", Subscriber.Source.FOOTER)

        self.assertEqual(subscriber.email, "racer@example.test")
        self.assertEqual(Subscriber.objects.count(), 1)
        # The row was sent one recently, so the cooldown suppresses a second.
        mailer.assert_not_called()


class SubscriberModelTests(TestCase):
    """Mailing-list consent records behave as the story requires."""

    def create_subscriber(self, **overrides):
        data = {
            "email": "member@example.test",
            "source": Subscriber.Source.FOOTER,
        }
        data.update(overrides)
        return Subscriber.objects.create(**data)

    def test_defaults_match_a_fresh_opt_in(self):
        subscriber = self.create_subscriber()

        self.assertEqual(subscriber.status, Subscriber.Status.SUBSCRIBED)
        self.assertIsNone(subscriber.unsubscribed_at)
        self.assertFalse(subscriber.provider_synced)
        self.assertIsNotNone(subscriber.subscribed_at)

    def test_email_is_unique_at_the_database_level(self):
        self.create_subscriber(email="duplicate@example.test")

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                self.create_subscriber(email="duplicate@example.test")

    def test_database_rejects_an_unsupported_status(self):
        subscriber = self.create_subscriber()

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Subscriber.objects.filter(pk=subscriber.pk).update(status="bogus")

        subscriber.refresh_from_db()
        self.assertEqual(subscriber.status, Subscriber.Status.SUBSCRIBED)

    def test_missing_email_is_reported_by_full_clean(self):
        subscriber = Subscriber(source=Subscriber.Source.FOOTER)

        with self.assertRaises(ValidationError) as caught:
            subscriber.full_clean()

        self.assertIn("email", caught.exception.message_dict)

    def test_unknown_source_is_rejected_by_full_clean(self):
        subscriber = Subscriber(email="member@example.test", source="telepathy")

        with self.assertRaises(ValidationError) as caught:
            subscriber.full_clean()

        self.assertIn("source", caught.exception.message_dict)

    def test_str_reports_address_and_status(self):
        subscriber = self.create_subscriber(email="member@example.test")

        self.assertEqual(str(subscriber), "member@example.test (subscribed)")

    def test_unsubscribed_row_records_when_it_happened(self):
        now = timezone.now()
        subscriber = self.create_subscriber(
            status=Subscriber.Status.UNSUBSCRIBED,
            unsubscribed_at=now,
        )

        subscriber.refresh_from_db()
        self.assertEqual(subscriber.status, Subscriber.Status.UNSUBSCRIBED)
        self.assertEqual(subscriber.unsubscribed_at, now)


class ResendAdapterTests(TestCase):
    """The adapter converts every SDK failure into ProviderError."""

    def setUp(self):
        self.provider = ResendProvider()

    def test_construction_sets_a_short_request_timeout(self):
        # The SDK default is 30 seconds; a signup can make two calls, so this
        # must stay short. Import is not needed: the client is the SDK's own.
        self.assertEqual(resend.default_http_client._timeout, 10)

    def test_unsubscribe_url_is_the_provider_placeholder(self):
        self.assertEqual(
            self.provider.unsubscribe_url,
            UNSUBSCRIBE_URL_PLACEHOLDER,
        )

    @override_settings(RESEND_SEGMENT_ID="seg_123", RESEND_FROM_EMAIL="a@example.test")
    def test_send_email_posts_the_expected_payload(self):
        with patch("resend.Emails.send") as send:
            self.provider.send_email(to="b@example.test", subject="Hi", html="<p>Hi</p>")

        send.assert_called_once_with(
            {
                "from": "a@example.test",
                "to": "b@example.test",
                "subject": "Hi",
                "html": "<p>Hi</p>",
            }
        )

    @override_settings(RESEND_SEGMENT_ID="seg_123")
    def test_upsert_contact_adds_the_segment_on_create(self):
        not_found = ResendError(
            code=404, error_type="not_found", message="Contact not found",
            suggested_action="",
        )
        with patch("resend.Contacts.get", side_effect=not_found):
            with patch("resend.Contacts.create") as create:
                self.provider.upsert_contact("user@example.test")

        create.assert_called_once_with(
            {"email": "user@example.test", "segments": [{"id": "seg_123"}]}
        )

    @override_settings(RESEND_SEGMENT_ID="seg_123")
    def test_upsert_contact_creates_a_contact_that_does_not_exist(self):
        not_found = ResendError(
            code=404, error_type="not_found", message="Contact not found",
            suggested_action="",
        )
        with patch("resend.Contacts.get", side_effect=not_found):
            with patch("resend.Contacts.create") as create:
                state = self.provider.upsert_contact("user@example.test")

        self.assertEqual(state, ContactState.SUBSCRIBED)
        create.assert_called_once_with(
            {"email": "user@example.test", "segments": [{"id": "seg_123"}]}
        )

    @override_settings(RESEND_SEGMENT_ID="seg_123")
    def test_upsert_contact_returns_subscribed_for_an_existing_subscribed_contact(self):
        contact = {"id": "c_1", "email": "user@example.test", "unsubscribed": False}
        with patch("resend.Contacts.get", return_value=contact):
            with patch("resend.Contacts.create") as create:
                with patch("resend.Contacts.Segments.add") as add:
                    state = self.provider.upsert_contact("user@example.test")

        self.assertEqual(state, ContactState.SUBSCRIBED)
        create.assert_called_once()
        # Segments.add has never been exercised against the live API, so the
        # get is a guard only and create does the segment linking.
        add.assert_not_called()

    @override_settings(RESEND_SEGMENT_ID="seg_123")
    def test_upsert_contact_leaves_a_provider_side_opt_out_untouched(self):
        contact = {"id": "c_1", "email": "user@example.test", "unsubscribed": True}
        with patch("resend.Contacts.get", return_value=contact):
            with patch("resend.Contacts.create") as create:
                state = self.provider.upsert_contact("user@example.test")

        self.assertEqual(state, ContactState.UNSUBSCRIBED)
        # Resend's create would flip this contact back to subscribed.
        create.assert_not_called()

    @override_settings(RESEND_SEGMENT_ID="seg_123")
    def test_remove_contact_removes_segment_membership(self):
        with patch("resend.Contacts.Segments.remove") as remove:
            self.provider.remove_contact("user@example.test")

        remove.assert_called_once_with(
            {"segment_id": "seg_123", "email": "user@example.test"}
        )

    @override_settings(RESEND_SEGMENT_ID="seg_123", RESEND_FROM_EMAIL="a@example.test")
    def test_send_broadcast_sends_immediately_to_the_segment(self):
        with patch("resend.Broadcasts.create") as create:
            self.provider.send_broadcast(subject="News", html="<p>News</p>")

        create.assert_called_once_with(
            {
                "segment_id": "seg_123",
                "from": "a@example.test",
                "subject": "News",
                "html": "<p>News</p>",
                "send": True,
            }
        )

    def test_sdk_failure_becomes_provider_error(self):
        with patch("resend.Emails.send", side_effect=Exception("boom")):
            with self.assertRaises(ProviderError):
                self.provider.send_email(to="b@example.test", subject="Hi", html="<p>Hi</p>")

    @override_settings(RESEND_SEGMENT_ID="")
    def test_missing_segment_id_fails_before_contacting_resend(self):
        with patch("resend.Contacts.get") as get:
            with patch("resend.Contacts.create") as create:
                with self.assertRaises(ProviderError):
                    self.provider.upsert_contact("user@example.test")

        get.assert_not_called()
        create.assert_not_called()

    @override_settings(RESEND_SEGMENT_ID="")
    def test_missing_segment_id_blocks_removal_and_broadcast(self):
        with patch("resend.Contacts.Segments.remove") as remove:
            with patch("resend.Broadcasts.create") as broadcast:
                with self.assertRaises(ProviderError):
                    self.provider.remove_contact("user@example.test")
                with self.assertRaises(ProviderError):
                    self.provider.send_broadcast(subject="News", html="<p>News</p>")

        remove.assert_not_called()
        broadcast.assert_not_called()

    @override_settings(RESEND_SEGMENT_ID="seg_123")
    def test_non_404_lookup_failure_becomes_provider_error(self):
        server_error = ResendError(
            code=500, error_type="application_error", message="Something went wrong",
            suggested_action="",
        )
        with patch("resend.Contacts.get", side_effect=server_error):
            with patch("resend.Contacts.create") as create:
                with self.assertRaises(ProviderError):
                    self.provider.upsert_contact("user@example.test")

        # A 500 must not be mistaken for "not found", which would overwrite an
        # opt-out the provider might be holding.
        create.assert_not_called()

    def test_provider_error_does_not_leak_sdk_text(self):
        with patch("resend.Emails.send", side_effect=Exception("secret-detail")):
            with self.assertRaises(ProviderError) as caught:
                self.provider.send_email(to="b@example.test", subject="Hi", html="<p>Hi</p>")

        self.assertNotIn("secret-detail", str(caught.exception))


class EmailServiceProviderRoutingTests(TestCase):
    """Transactional sending keeps its behavior while routing through the interface."""

    CONTEXT = {
        "first_name": "",
        "event_name": "Event",
        "start_datetime": "Jan 1, 2026 at 10:00 AM",
        "location": "Hall",
    }

    @override_settings(RESEND_FROM_EMAIL="a@example.test", EMAIL_SEND_TO_DEV=False)
    def test_send_email_routes_through_the_provider(self):
        with patch("resend.Emails.send") as send:
            send_email(
                to="b@example.test",
                subject="Subject",
                template_name="emails/event_reminder.html",
                context=self.CONTEXT,
            )

        payload = send.call_args[0][0]
        self.assertEqual(payload["to"], "b@example.test")
        self.assertEqual(payload["subject"], "Subject")

    @override_settings(
        DEBUG=True,
        EMAIL_SEND_TO_DEV=True,
        RESEND_DEV_ALERT_EMAIL="dev@example.test",
        RESEND_FROM_EMAIL="a@example.test",
    )
    def test_dev_interception_still_redirects_the_recipient(self):
        with patch("resend.Emails.send") as send:
            send_email(
                to="real@example.test",
                subject="Subject",
                template_name="emails/event_reminder.html",
                context=self.CONTEXT,
            )

        payload = send.call_args[0][0]
        self.assertEqual(payload["to"], "dev@example.test")
        self.assertIn("real@example.test", payload["subject"])

    @override_settings(RESEND_FROM_EMAIL="a@example.test", RESEND_DEV_ALERT_EMAIL="")
    def test_send_failure_is_swallowed(self):
        with patch("resend.Emails.send", side_effect=Exception("boom")):
            # A provider outage must not raise into the transactional caller.
            send_email(
                to="b@example.test",
                subject="Subject",
                template_name="emails/event_reminder.html",
                context=self.CONTEXT,
            )

    @override_settings(RESEND_FROM_EMAIL="a@example.test", RESEND_DEV_ALERT_EMAIL="")
    def test_misconfiguration_is_swallowed(self):
        # A bad EMAIL_PROVIDER must not break password resets or signups.
        with override_settings(EMAIL_PROVIDER="does-not-exist"):
            send_email(
                to="b@example.test",
                subject="Subject",
                template_name="emails/event_reminder.html",
                context=self.CONTEXT,
            )

    @override_settings(RESEND_FROM_EMAIL="a@example.test", RESEND_DEV_ALERT_EMAIL="")
    def test_underlying_cause_is_logged_not_the_generic_message(self):
        with patch("resend.Emails.send", side_effect=Exception("sdk-detail")):
            with self.assertLogs("emails.services", level="ERROR") as captured:
                send_email(
                    to="b@example.test",
                    subject="Subject",
                    template_name="emails/event_reminder.html",
                    context=self.CONTEXT,
                )

        self.assertIn("sdk-detail", "\n".join(captured.output))

    @override_settings(
        RESEND_FROM_EMAIL="a@example.test",
        RESEND_DEV_ALERT_EMAIL="dev@example.test",
    )
    def test_dev_alert_includes_the_underlying_cause(self):
        with patch("resend.Emails.send", side_effect=Exception("sdk-detail")):
            with patch("emails.services._send_dev_alert") as alert:
                send_email(
                    to="b@example.test",
                    subject="Subject",
                    template_name="emails/event_reminder.html",
                    context=self.CONTEXT,
                )

        self.assertIn("sdk-detail", alert.call_args[0][2])


class SubscribeEndpointTests(TestCase):
    """The public signup endpoint hides whether an address is already known."""

    def setUp(self):
        self.client = APIClient()
        # Throttle history is cached across tests; clear it so the rate-limit
        # test is not affected by the other signup tests.
        cache.clear()

    def post(self, **overrides):
        payload = {"email": "member@example.test", "source": "footer"}
        payload.update(overrides)
        return self.client.post("/api/emails/subscribe/", payload, format="json")

    def test_valid_signup_creates_a_subscriber(self):
        with patch("emails.views.subscribe_contact") as subscribe:
            response = self.post()

        self.assertEqual(response.status_code, 200)
        subscribe.assert_called_once_with("member@example.test", "footer")

    def test_repeat_signup_returns_an_identical_response(self):
        with patch("emails.views.subscribe_contact"):
            first = self.post()
            second = self.post()

        # Identical bodies: a caller must not be able to probe for membership.
        self.assertEqual(first.status_code, second.status_code)
        self.assertEqual(first.json(), second.json())

    def test_unsubscribed_address_returns_the_same_response(self):
        Subscriber.objects.create(
            email="gone@example.test",
            source=Subscriber.Source.FOOTER,
            status=Subscriber.Status.UNSUBSCRIBED,
            unsubscribed_at=timezone.now(),
        )

        with patch("emails.views.subscribe_contact"):
            response = self.post(email="gone@example.test")

        # Same response as any other signup: coming back is not announced here,
        # it only happens when the address confirms from its own inbox.
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), SUBSCRIBE_RESPONSE)

    def test_unsubscribe_then_resubscribe_starts_a_pending_flow(self):
        Subscriber.objects.create(
            email="gone@example.test",
            source=Subscriber.Source.FOOTER,
            status=Subscriber.Status.UNSUBSCRIBED,
            unsubscribed_at=timezone.now() - timedelta(days=30),
        )

        with patch("emails.views.subscribe_contact") as subscribe:
            response = self.post(email="gone@example.test")

        # The endpoint still records intent only; the status only changes when
        # the confirmation link is followed.
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), SUBSCRIBE_RESPONSE)
        subscribe.assert_called_once_with("gone@example.test", "footer")

    def test_invalid_email_is_rejected(self):
        response = self.post(email="not-an-email")

        self.assertEqual(response.status_code, 400)

    def test_unknown_source_is_rejected(self):
        response = self.post(source="telepathy")

        self.assertEqual(response.status_code, 400)

    def test_email_is_normalized_before_reaching_the_service(self):
        with patch("emails.views.subscribe_contact") as subscribe:
            self.post(email="  Member@Example.Test ")

        subscribe.assert_called_once_with("member@example.test", "footer")

    def test_filled_honeypot_is_accepted_but_ignored(self):
        with patch("emails.views.subscribe_contact") as subscribe:
            response = self.post(website="http://spam.example")

        # Same answer as a real signup, but nothing was recorded.
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), SUBSCRIBE_RESPONSE)
        subscribe.assert_not_called()

    def test_rapid_requests_from_one_ip_are_throttled(self):
        # DRF reads the rate table when the throttle class loads, so
        # override_settings cannot change it here. Patch the rate the throttle
        # actually consults, keeping this test independent of the real value.
        with patch.dict(ScopedRateThrottle.THROTTLE_RATES, {"email_subscribe": "2/hour"}):
            with patch("emails.views.subscribe_contact"):
                responses = [self.post() for _ in range(3)]

        self.assertEqual(responses[0].status_code, 200)
        self.assertEqual(responses[1].status_code, 200)
        # The third request from the same IP is over the limit.
        self.assertEqual(responses[2].status_code, 429)

    def test_database_failure_returns_a_generic_error(self):
        with patch("emails.views.subscribe_contact", side_effect=DatabaseError):
            response = self.post()

        self.assertEqual(response.status_code, 503)
        self.assertNotIn("DatabaseError", str(response.json()))

    def test_mailer_failure_still_returns_the_public_response(self):
        # A failure in the mail path must not change the response, or a caller
        # could use failures to probe whether an address is known.
        with patch(
            "emails.subscribers.send_subscription_confirmation_email",
            side_effect=ProviderError("down"),
        ):
            response = self.post()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), SUBSCRIBE_RESPONSE)
        self.assertEqual(
            Subscriber.objects.get(email="member@example.test").status,
            Subscriber.Status.PENDING,
        )


class ResendWebhookTests(TestCase):
    """Signed unsubscribe deliveries sync our records; everything else is ignored.

    The payload shape used here comes from Resend's documentation. A real signed
    delivery has not been observed, so these tests pin our own contract rather
    than a confirmed wire format.
    """

    # Sign with the same secret the handler reads, so these tests do not depend
    # on a duplicated literal. No real secret is involved.
    SECRET = settings.RESEND_WEBHOOK_SECRET

    def setUp(self):
        self.client = APIClient()

    def sign(self, body: bytes, secret=None, timestamp=None, svix_id="msg_test_1"):
        """Produce the Svix headers Resend would send for this body.

        Returned as Django test-client ``extra`` names, because passing raw
        header names to ``client.post`` would not set real request headers.
        """
        if timestamp is None:
            timestamp = str(int(time.time()))
        raw_secret = (secret or self.SECRET)
        decoded = base64.b64decode(raw_secret.removeprefix("whsec_"))
        content = f"{svix_id}.{timestamp}.".encode() + body
        signature = base64.b64encode(
            hmac.new(decoded, content, hashlib.sha256).digest()
        ).decode()
        return {
            "HTTP_SVIX_ID": svix_id,
            "HTTP_SVIX_TIMESTAMP": timestamp,
            "HTTP_SVIX_SIGNATURE": f"v1,{signature}",
        }

    def deliver(self, payload: dict, **sign_kwargs):
        body = json.dumps(payload).encode()
        extra = self.sign(body, **sign_kwargs)
        return self.client.post(
            self.URL, body, content_type="application/json", **extra
        )

    def contact_payload(self, email, unsubscribed):
        return {
            "type": "contact.updated",
            "data": {"email": email, "unsubscribed": unsubscribed},
        }

    URL = "/api/emails/webhooks/resend/"

    def create_subscriber(self, email="member@example.test", **overrides):
        data = {
            "email": email,
            "source": Subscriber.Source.FOOTER,
        }
        data.update(overrides)
        return Subscriber.objects.create(**data)

    def test_signed_unsubscribe_event_marks_the_row_unsubscribed(self):
        self.create_subscriber("member@example.test")

        response = self.deliver(self.contact_payload("member@example.test", True))

        self.assertEqual(response.status_code, 200)
        subscriber = Subscriber.objects.get(email="member@example.test")
        self.assertEqual(subscriber.status, Subscriber.Status.UNSUBSCRIBED)
        self.assertIsNotNone(subscriber.unsubscribed_at)

    def test_email_is_normalized_before_matching(self):
        self.create_subscriber("member@example.test")

        self.deliver(self.contact_payload("  Member@Example.Test ", True))

        subscriber = Subscriber.objects.get(email="member@example.test")
        self.assertEqual(subscriber.status, Subscriber.Status.UNSUBSCRIBED)

    def test_duplicate_delivery_is_a_no_op(self):
        self.create_subscriber("member@example.test")

        first = self.deliver(self.contact_payload("member@example.test", True))
        original = Subscriber.objects.get(email="member@example.test").unsubscribed_at
        second = self.deliver(self.contact_payload("member@example.test", True))

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        after = Subscriber.objects.get(email="member@example.test").unsubscribed_at
        # A redelivery must not move the recorded time.
        self.assertEqual(after, original)

    def test_contact_deleted_is_treated_as_an_unsubscribe(self):
        self.create_subscriber("gone@example.test")

        response = self.deliver({"type": "contact.deleted", "data": {"email": "gone@example.test"}})

        self.assertEqual(response.status_code, 200)
        subscriber = Subscriber.objects.get(email="gone@example.test")
        self.assertEqual(subscriber.status, Subscriber.Status.UNSUBSCRIBED)

    def test_unsubscribed_false_never_flips_a_row_back_to_subscribed(self):
        # Our own create and segment-remove calls emit this event.
        self.create_subscriber(
            "resub@example.test",
            status=Subscriber.Status.UNSUBSCRIBED,
            unsubscribed_at=timezone.now(),
        )

        response = self.deliver(self.contact_payload("resub@example.test", False))

        self.assertEqual(response.status_code, 200)
        subscriber = Subscriber.objects.get(email="resub@example.test")
        self.assertEqual(subscriber.status, Subscriber.Status.UNSUBSCRIBED)

    def test_unknown_email_is_quietly_ignored(self):
        response = self.deliver(self.contact_payload("nobody@example.test", True))

        self.assertEqual(response.status_code, 200)
        self.assertFalse(Subscriber.objects.filter(email="nobody@example.test").exists())

    def test_already_unsubscribed_row_keeps_its_timestamp(self):
        original = timezone.now() - timedelta(days=1)
        self.create_subscriber(
            "old@example.test",
            status=Subscriber.Status.UNSUBSCRIBED,
            unsubscribed_at=original,
        )

        response = self.deliver(self.contact_payload("old@example.test", True))

        self.assertEqual(response.status_code, 200)
        subscriber = Subscriber.objects.get(email="old@example.test")
        self.assertEqual(subscriber.unsubscribed_at, original)

    def test_tampered_body_is_rejected(self):
        self.create_subscriber("member@example.test")
        body = json.dumps(self.contact_payload("member@example.test", True)).encode()
        extra = self.sign(body)
        # Replace the body after signing it.
        tampered = json.dumps(self.contact_payload("attacker@example.test", True)).encode()

        response = self.client.post(
            self.URL, tampered, content_type="application/json", **extra
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            Subscriber.objects.get(email="member@example.test").status,
            Subscriber.Status.SUBSCRIBED,
        )

    def test_stale_timestamp_is_rejected(self):
        self.create_subscriber("member@example.test")
        stale = str(int(time.time()) - 3600)
        body = json.dumps(self.contact_payload("member@example.test", True)).encode()
        extra = self.sign(body, timestamp=stale)

        response = self.client.post(
            self.URL, body, content_type="application/json", **extra
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            Subscriber.objects.get(email="member@example.test").status,
            Subscriber.Status.SUBSCRIBED,
        )

    def test_signature_from_a_different_secret_is_rejected(self):
        self.create_subscriber("member@example.test")
        other = "whsec_" + base64.b64encode(b"a-different-secret").decode()
        body = json.dumps(self.contact_payload("member@example.test", True)).encode()
        extra = self.sign(body, secret=other)

        response = self.client.post(
            self.URL, body, content_type="application/json", **extra
        )

        self.assertEqual(response.status_code, 400)

    def test_missing_signature_headers_are_rejected(self):
        self.create_subscriber("member@example.test")
        body = json.dumps(self.contact_payload("member@example.test", True)).encode()

        response = self.client.post(self.URL, body, content_type="application/json")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            Subscriber.objects.get(email="member@example.test").status,
            Subscriber.Status.SUBSCRIBED,
        )

    def test_error_body_never_echoes_signature_details(self):
        body = b'{"type":"contact.updated"}'
        extra = self.sign(b"a-completely-different-body")
        extra["HTTP_SVIX_SIGNATURE"] = "v1,not-a-real-signature"

        response = self.client.post(
            self.URL, body, content_type="application/json", **extra
        )

        self.assertEqual(response.status_code, 400)
        self.assertNotIn("v1,", str(response.json()))
        self.assertNotIn("whsec_", str(response.json()))

    def test_recognized_event_without_a_usable_email_is_ignored(self):
        # Payload shape is unverified, so a missing or non-string email must not
        # break the handler.
        for data in ({"unsubscribed": True}, {"email": 123, "unsubscribed": True}):
            with self.subTest(data=data):
                response = self.deliver({"type": "contact.updated", "data": data})
                self.assertEqual(response.status_code, 200)

    def test_unknown_event_type_is_ignored(self):
        self.create_subscriber("member@example.test")

        response = self.deliver(
            {"type": "email.delivered", "data": {"email": "member@example.test"}}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            Subscriber.objects.get(email="member@example.test").status,
            Subscriber.Status.SUBSCRIBED,
        )

    @override_settings(RESEND_WEBHOOK_SECRET="")
    def test_unconfigured_secret_rejects_every_request(self):
        self.create_subscriber("member@example.test")

        response = self.deliver(self.contact_payload("member@example.test", True))

        # Fail closed: an unset secret must never accept an unsigned request.
        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            Subscriber.objects.get(email="member@example.test").status,
            Subscriber.Status.SUBSCRIBED,
        )


class SubscriptionConfirmationTemplateTests(TestCase):
    """The confirmation email carries the link and no marketing footer."""

    CONTEXT = {
        "confirmation_url": "https://example.test/subscribe/confirm?token=abc123",
    }

    def test_link_and_expiry_are_rendered(self):
        html = render_to_string("emails/subscribe_confirm.html", self.CONTEXT)

        self.assertIn(self.CONTEXT["confirmation_url"], html)
        self.assertIn("48 hours", html)

    def test_transactional_footer_is_not_rendered(self):
        html = render_to_string("emails/subscribe_confirm.html", self.CONTEXT)

        # Confirming a subscription is transactional, so no unsubscribe link.
        self.assertNotIn("Unsubscribe from future announcements", html)


class AnnouncementTemplateTests(TestCase):
    """The announcement body carries the CAN-SPAM footer without provider syntax."""

    CONTEXT = {
        "announcement_title": "Summer Festival",
        "announcement_body_html": "<p>Save the date.</p>",
        "unsubscribe_url": UNSUBSCRIBE_URL_PLACEHOLDER,
    }

    def test_footer_renders_the_unsubscribe_link_and_mailing_address(self):
        html = render_to_string("emails/announcement.html", self.CONTEXT)

        self.assertIn(UNSUBSCRIBE_URL_PLACEHOLDER, html)
        self.assertIn("Unsubscribe from future announcements", html)
        self.assertIn("PO BOX 162785, Sacramento, CA 95816", html)

    def test_body_and_title_are_rendered(self):
        html = render_to_string("emails/announcement.html", self.CONTEXT)

        self.assertIn("Summer Festival", html)
        self.assertIn("<p>Save the date.</p>", html)

    def test_template_contains_no_resend_specific_syntax(self):
        # The provider placeholder arrives as a context value, so the template
        # itself must never name the provider.
        template = (
            pathlib.Path(__file__).resolve().parent
            / "templates"
            / "emails"
            / "announcement.html"
        ).read_text(encoding="utf-8")

        self.assertNotIn("RESEND", template)

    def test_transactional_templates_do_not_render_the_unsubscribe_footer(self):
        # The footer block must stay empty for emails that are not marketing.
        html = render_to_string(
            "emails/event_reminder.html",
            {
                "first_name": "",
                "event_name": "Event",
                "start_datetime": "Jan 1, 2026 at 10:00 AM",
                "location": "Hall",
            },
        )

        self.assertNotIn("Unsubscribe from future announcements", html)


class AnnouncementEndpointTests(TestCase):
    """The announcement endpoint is admin-only and forwards the supplied HTML."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="admin@example.test",
            password="TestPass123!",
            first_name="Admin",
            last_name="User",
            is_staff=True,
        )

    def test_anonymous_request_is_rejected(self):
        response = self.client.post(
            "/api/emails/announcements/send/",
            {"subject": "News", "html": "<p>News</p>"},
            format="json",
        )
        self.assertIn(response.status_code, (401, 403))

    def test_missing_subject_or_html_is_rejected(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/emails/announcements/send/", {"subject": "News"}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_admin_request_renders_the_template_before_sending(self):
        self.client.force_authenticate(user=self.user)
        with patch("emails.views.get_provider") as get_provider_mock:
            get_provider_mock.return_value.unsubscribe_url = "https://unsubscribe.test/abc"
            response = self.client.post(
                "/api/emails/announcements/send/",
                {"subject": "News", "title": "Latest news", "html": "<p>Body</p>"},
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        sent = get_provider_mock.return_value.send_broadcast.call_args.kwargs
        self.assertEqual(sent["subject"], "News")
        # The provider gets rendered HTML, not the raw submitted fragment.
        self.assertIn("Latest news", sent["html"])
        self.assertIn("<p>Body</p>", sent["html"])
        # The footer value comes from the provider, not a hardcoded constant.
        self.assertIn('href="https://unsubscribe.test/abc"', sent["html"])
        self.assertIn("Unsubscribe from future announcements", sent["html"])

    def test_the_same_provider_instance_renders_and_sends(self):
        self.client.force_authenticate(user=self.user)
        with patch("emails.views.get_provider") as get_provider_mock:
            get_provider_mock.return_value.unsubscribe_url = "https://unsubscribe.test/abc"
            self.client.post(
                "/api/emails/announcements/send/",
                {"subject": "News", "html": "<p>News</p>"},
                format="json",
            )

        get_provider_mock.assert_called_once()
        get_provider_mock.return_value.send_broadcast.assert_called_once()

    def test_provider_failure_returns_a_generic_error(self):
        self.client.force_authenticate(user=self.user)
        with patch("emails.views.get_provider") as get_provider_mock:
            get_provider_mock.return_value.send_broadcast.side_effect = ProviderError(
                "provider-internal-detail"
            )
            response = self.client.post(
                "/api/emails/announcements/send/",
                {"subject": "News", "html": "<p>News</p>"},
                format="json",
            )

        self.assertEqual(response.status_code, 503)
        self.assertNotIn("provider-internal-detail", str(response.json()))

    def test_provider_failure_logs_the_underlying_cause(self):
        # Without the cause, a failure like an unverified sending domain would
        # be an unexplained 503.
        self.client.force_authenticate(user=self.user)
        provider_error = ProviderError("generic")
        provider_error.__cause__ = RuntimeError("Broadcasts cannot be sent from resend.dev.")
        with patch("emails.views.get_provider") as get_provider_mock:
            get_provider_mock.return_value.send_broadcast.side_effect = provider_error
            with self.assertLogs("emails.views", level="ERROR") as captured:
                self.client.post(
                    "/api/emails/announcements/send/",
                    {"subject": "News", "html": "<p>News</p>"},
                    format="json",
                )

        self.assertIn("Broadcasts cannot be sent from resend.dev.", "\n".join(captured.output))

