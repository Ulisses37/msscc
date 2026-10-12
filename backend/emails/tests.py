import pathlib
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ImproperlyConfigured
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from emails.providers import ProviderError, get_provider
from emails.providers.base import EmailProvider
from emails.providers.resend import ResendProvider
from emails.services import send_email

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


class ResendAdapterTests(TestCase):
    """The adapter converts every SDK failure into ProviderError."""

    def setUp(self):
        self.provider = ResendProvider()

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
        with patch("resend.Contacts.create") as create:
            self.provider.upsert_contact("user@example.test")

        create.assert_called_once_with(
            {"email": "user@example.test", "segments": [{"id": "seg_123"}]}
        )

    @override_settings(RESEND_SEGMENT_ID="seg_123")
    def test_upsert_contact_falls_back_to_segment_add_for_existing_contact(self):
        with patch("resend.Contacts.create", side_effect=Exception("already exists")):
            with patch("resend.Contacts.Segments.add") as add:
                self.provider.upsert_contact("user@example.test")

        add.assert_called_once_with({"segment_id": "seg_123", "email": "user@example.test"})

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
        with patch("resend.Contacts.create") as create:
            with self.assertRaises(ProviderError):
                self.provider.upsert_contact("user@example.test")

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
    def test_upsert_contact_fails_when_create_and_segment_add_both_fail(self):
        with patch("resend.Contacts.create", side_effect=Exception("exists")):
            with patch("resend.Contacts.Segments.add", side_effect=Exception("denied")):
                with self.assertRaises(ProviderError):
                    self.provider.upsert_contact("user@example.test")

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

