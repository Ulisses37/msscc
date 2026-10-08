from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.template.loader import render_to_string
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from events.models import Event, VolunteerSignup, VolunteerSlot

User = get_user_model()


class EventListAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="admin@example.com",
            password="TestPass123!",
            first_name="Admin",
            last_name="User",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_get_list_returns_empty_on_no_events(self):
        response = self.client.get("/api/events/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_post_event_requires_title_en(self):
        response = self.client.post(
            "/api/events/",
            {
                "title_ja": "タイトル",
                "start_datetime": "2026-12-25T10:00:00Z",
                "end_datetime": "2026-12-25T12:00:00Z",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_post_event_requires_start_datetime(self):
        response = self.client.post(
            "/api/events/",
            {
                "title_en": "Event",
                "title_ja": "イベント",
                "end_datetime": "2026-12-25T12:00:00Z",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_post_create_event_succeeds(self):
        response = self.client.post(
            "/api/events/",
            {
                "title_en": "Cultural Exchange",
                "title_ja": "文化交流",
                "start_datetime": "2026-12-25T10:00:00Z",
                "end_datetime": "2026-12-25T12:00:00Z",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Event.objects.count(), 1)
        event = Event.objects.first()
        self.assertEqual(event.title_en, "Cultural Exchange")
        self.assertEqual(event.title_ja, "文化交流")
        self.assertFalse(event.is_published)


@override_settings(FRONTEND_URL="https://example.test")
class VolunteerSignupEmailTests(TestCase):
    """Verify volunteer signup confirmation emails include cancellation links."""

    def setUp(self):
        self.client = APIClient()
        self.event = Event.objects.create(
            title_en="Cultural Exchange",
            title_ja="文化交流",
            start_datetime=datetime(2026, 12, 25, 10, 0, tzinfo=UTC),
            end_datetime=datetime(2026, 12, 25, 12, 0, tzinfo=UTC),
        )
        self.slot = VolunteerSlot.objects.create(
            event=self.event,
            position_name="Greeter",
            start_datetime=datetime(2026, 12, 25, 10, 0, tzinfo=UTC),
            end_datetime=datetime(2026, 12, 25, 12, 0, tzinfo=UTC),
        )

    @patch("events.views.send_volunteer_thanks_email")
    def test_successful_signup_sends_confirmation_email(self, mock_send_email):
        response = self.client.post(
            "/api/events/signups/",
            {
                "slot_id": self.slot.volunteer_slot_id,
                "first_name": "Aiko",
                "last_name": "Tanaka",
                "email": "aiko@example.com",
                "phone": "916-555-0100",
                "status": "pending",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        signup = VolunteerSignup.objects.get()
        mock_send_email.assert_called_once_with(signup)
        self.assertIsNotNone(signup.cancellation_token)

    @patch("emails.messages.send_email")
    def test_confirmation_email_includes_unique_cancellation_url(self, mock_send_email):
        signup = VolunteerSignup.objects.create(
            slot=self.slot,
            first_name="Aiko",
            last_name="Tanaka",
            email="aiko@example.com",
            phone="916-555-0100",
        )

        from emails.messages import send_volunteer_thanks_email

        send_volunteer_thanks_email(signup)

        expected_url = f"https://example.test/en/volunteer/cancel/{signup.cancellation_token}"
        mock_send_email.assert_called_once()
        template_name = mock_send_email.call_args.kwargs["template_name"]
        context = mock_send_email.call_args.kwargs["context"]

        self.assertEqual(context["cancellation_url"], expected_url)
        rendered_email = render_to_string(template_name, context)
        self.assertIn("Cancel volunteer shift", rendered_email)
        self.assertIn(expected_url, rendered_email)

    def test_new_signups_receive_distinct_cancellation_tokens(self):
        first_signup = VolunteerSignup.objects.create(
            slot=self.slot,
            first_name="Aiko",
            last_name="Tanaka",
            email="aiko@example.com",
            phone="916-555-0100",
        )
        second_signup = VolunteerSignup.objects.create(
            slot=self.slot,
            first_name="Kenji",
            last_name="Sato",
            email="kenji@example.com",
            phone="916-555-0101",
        )

        self.assertNotEqual(first_signup.cancellation_token, second_signup.cancellation_token)

    @patch("events.views.send_volunteer_thanks_email")
    def test_invalid_signup_does_not_send_confirmation_email(self, mock_send_email):
        response = self.client.post(
            "/api/events/signups/",
            {
                "slot_id": self.slot.volunteer_slot_id,
                "first_name": "Aiko",
                "last_name": "Tanaka",
                "email": "not-an-email",
                "phone": "916-555-0100",
                "status": "pending",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        mock_send_email.assert_not_called()


class VolunteerCancellationLookupTests(TestCase):
    """Verify public cancellation-link lookup behavior."""

    def create_signup(self, start_datetime, **overrides):
        event = Event.objects.create(
            title_en="Cultural Exchange",
            title_ja="文化交流",
            start_datetime=start_datetime,
            end_datetime=start_datetime + timedelta(hours=2),
        )
        slot = VolunteerSlot.objects.create(
            event=event,
            position_name="Greeter",
            start_datetime=start_datetime,
            end_datetime=start_datetime + timedelta(hours=2),
        )
        signup_data = {
            "slot": slot,
            "first_name": "Aiko",
            "last_name": "Tanaka",
            "email": "aiko@example.com",
            "phone": "916-555-0100",
            **overrides,
        }
        return VolunteerSignup.objects.create(**signup_data)

    def test_valid_token_returns_public_signup_details(self):
        signup = self.create_signup(datetime.now(UTC) + timedelta(days=1))

        response = self.client.get(f"/api/events/signups/cancel/{signup.cancellation_token}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "first_name": "Aiko",
                "last_name": "Tanaka",
                "event_title_en": "Cultural Exchange",
                "event_title_ja": "文化交流",
                "slot_start_datetime": (
                    signup.slot.start_datetime.isoformat().replace("+00:00", "Z")
                ),
                "slot_end_datetime": signup.slot.end_datetime.isoformat().replace("+00:00", "Z"),
                "role": "Greeter",
            },
        )
        signup.refresh_from_db()
        self.assertEqual(signup.status, "approved")

    def test_unknown_token_returns_not_found(self):
        token = "00000000-0000-0000-0000-000000000000"

        response = self.client.get(f"/api/events/signups/cancel/{token}/")

        self.assertEqual(response.status_code, 404)

    def test_expired_token_returns_not_found(self):
        signup = self.create_signup(datetime.now(UTC) - timedelta(minutes=1))

        response = self.client.get(f"/api/events/signups/cancel/{signup.cancellation_token}/")

        self.assertEqual(response.status_code, 404)
