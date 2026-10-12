import ast
import pathlib
from unittest.mock import patch

import resend
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.db import DatabaseError, IntegrityError, transaction
from django.test import TestCase, override_settings
from django.utils import timezone
from resend.exceptions import ResendError
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from emails.models import Subscriber
from emails.providers import ContactState, ProviderError, get_provider
from emails.providers.base import EmailProvider
from emails.providers.resend import ResendProvider
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
    """subscribe_contact is the single entry point for every signup."""

    def patch_provider(self):
        return patch("emails.subscribers.get_provider")

    def test_creates_a_subscriber_with_the_normalized_email(self):
        with self.patch_provider():
            subscriber = subscribe_contact("  Member@Example.Test ", Subscriber.Source.DONATION)

        self.assertEqual(subscriber.email, "member@example.test")
        self.assertEqual(subscriber.source, Subscriber.Source.DONATION)
        self.assertEqual(subscriber.status, Subscriber.Status.SUBSCRIBED)

    def test_successful_sync_marks_the_row_as_synced(self):
        with self.patch_provider() as get_provider_mock:
            subscriber = subscribe_contact("member@example.test", Subscriber.Source.FOOTER)

        get_provider_mock.return_value.upsert_contact.assert_called_once_with(
            "member@example.test"
        )
        subscriber.refresh_from_db()
        self.assertTrue(subscriber.provider_synced)

    def test_repeat_signup_on_a_synced_row_skips_the_provider(self):
        with self.patch_provider() as get_provider_mock:
            subscribe_contact("member@example.test", Subscriber.Source.FOOTER)
            subscribe_contact("member@example.test", Subscriber.Source.FOOTER)

        self.assertEqual(Subscriber.objects.count(), 1)
        # The public endpoint must not hammer Resend on every repeat POST.
        self.assertEqual(get_provider_mock.return_value.upsert_contact.call_count, 1)

    def test_unsynced_row_is_retried_on_the_next_signup(self):
        with self.patch_provider() as get_provider_mock:
            get_provider_mock.return_value.upsert_contact.side_effect = Exception("down")
            subscribe_contact("member@example.test", Subscriber.Source.FOOTER)

        subscriber = Subscriber.objects.get(email="member@example.test")
        self.assertFalse(subscriber.provider_synced)

        with self.patch_provider() as retry_mock:
            subscribe_contact("member@example.test", Subscriber.Source.FOOTER)

        retry_mock.return_value.upsert_contact.assert_called_once_with("member@example.test")
        subscriber.refresh_from_db()
        self.assertTrue(subscriber.provider_synced)

    def test_unsubscribed_row_is_left_untouched_and_not_synced(self):
        Subscriber.objects.create(
            email="gone@example.test",
            source=Subscriber.Source.FOOTER,
            status=Subscriber.Status.UNSUBSCRIBED,
            unsubscribed_at=timezone.now(),
        )

        with self.patch_provider() as get_provider_mock:
            subscribe_contact("gone@example.test", Subscriber.Source.DONATION)

        # Anyone can reach the public endpoint, so an opt-out must not be undone.
        get_provider_mock.return_value.upsert_contact.assert_not_called()
        subscriber = Subscriber.objects.get(email="gone@example.test")
        self.assertEqual(subscriber.status, Subscriber.Status.UNSUBSCRIBED)
        self.assertIsNotNone(subscriber.unsubscribed_at)
        self.assertEqual(subscriber.source, Subscriber.Source.FOOTER)

    def test_provider_side_opt_out_marks_the_row_unsubscribed(self):
        with self.patch_provider() as get_provider_mock:
            get_provider_mock.return_value.upsert_contact.return_value = (
                ContactState.UNSUBSCRIBED
            )
            subscribe_contact("optout@example.test", Subscriber.Source.FOOTER)

        # The provider held an opt-out we did not know about, so record it
        # instead of leaving the row subscribed and sending to someone who opted out.
        subscriber = Subscriber.objects.get(email="optout@example.test")
        self.assertEqual(subscriber.status, Subscriber.Status.UNSUBSCRIBED)
        self.assertIsNotNone(subscriber.unsubscribed_at)
        self.assertTrue(subscriber.provider_synced)

    def test_provider_failure_still_saves_the_signup(self):
        with self.patch_provider() as get_provider_mock:
            get_provider_mock.return_value.upsert_contact.side_effect = ProviderError("down")
            subscriber = subscribe_contact("member@example.test", Subscriber.Source.FOOTER)

        self.assertEqual(subscriber.email, "member@example.test")
        subscriber.refresh_from_db()
        self.assertFalse(subscriber.provider_synced)

    def test_misconfiguration_still_saves_the_signup(self):
        # A bad EMAIL_PROVIDER must not turn a saved signup into a 500.
        with override_settings(EMAIL_PROVIDER="does-not-exist"):
            subscriber = subscribe_contact("member@example.test", Subscriber.Source.FOOTER)

        self.assertIsNotNone(subscriber.pk)
        subscriber.refresh_from_db()
        self.assertFalse(subscriber.provider_synced)

    def test_integrity_error_during_create_falls_back_to_the_existing_row(self):
        Subscriber.objects.create(
            email="racer@example.test",
            source=Subscriber.Source.FOOTER,
            provider_synced=True,
        )

        # Simulate losing the get_or_create race: the insert fails even though
        # the lookup found nothing, because the other request committed first.
        with patch.object(Subscriber.objects, "get_or_create", side_effect=IntegrityError):
            with self.patch_provider() as get_provider_mock:
                subscriber = subscribe_contact("racer@example.test", Subscriber.Source.FOOTER)

        self.assertEqual(subscriber.email, "racer@example.test")
        self.assertEqual(Subscriber.objects.count(), 1)
        # The existing row was already synced, so no duplicate provider call.
        get_provider_mock.return_value.upsert_contact.assert_not_called()


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

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), SUBSCRIBE_RESPONSE)

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

    def test_admin_request_forwards_the_html_unchanged(self):
        self.client.force_authenticate(user=self.user)
        html = "<p>Hello {{{RESEND_UNSUBSCRIBE_URL}}}</p>"
        with patch("emails.views.get_provider") as get_provider_mock:
            response = self.client.post(
                "/api/emails/announcements/send/",
                {"subject": "News", "html": html},
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        get_provider_mock.return_value.send_broadcast.assert_called_once_with(
            subject="News", html=html
        )

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

