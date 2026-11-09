from datetime import UTC, datetime
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework.throttling import AnonRateThrottle

from events.models import Event, VolunteerSignup, VolunteerSlot

User = get_user_model()

SIGNUP_URL = "/api/events/signups/"


class VolunteerSignupProtectionTests(TestCase):
    """Cover the signup validation and throttle behavior not exercised in tests.py."""

    def setUp(self):
        self.client = APIClient()
        # Throttle history is cache-backed, so keep tests independent.
        cache.clear()
        self.post_count = 0

        patcher = patch("events.views.send_volunteer_thanks_email")
        self.mock_send_email = patcher.start()
        self.addCleanup(patcher.stop)

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
            capacity=50,
        )
        self.payload = {
            "slot_id": self.slot.volunteer_slot_id,
            "first_name": "Aiko",
            "last_name": "Tanaka",
            "email": "aiko@example.com",
            "phone": "916-555-0100",
        }

    def post(self, client=None, **overrides):
        """Post a signup using a unique email unless a test specifies one."""
        self.post_count += 1
        payload = {
            **self.payload,
            "email": f"aiko{self.post_count}@example.com",
            **overrides,
        }
        return (client or self.client).post(
            SIGNUP_URL, payload, format="json"
        )

    # Validation

    def test_blank_or_whitespace_only_names_are_rejected(self):
        for field in ("first_name", "last_name"):
            for value in ("", "   "):
                with self.subTest(field=field, value=value):
                    response = self.post(**{field: value})

                    self.assertEqual(response.status_code, 400)
                    self.assertIn(field, response.json())

        self.assertEqual(VolunteerSignup.objects.count(), 0)
        self.mock_send_email.assert_not_called()

    def test_over_long_fields_are_rejected(self):
        for field, value in (
            ("first_name", "a" * 101),
            ("last_name", "a" * 101),
            ("phone", "1" * 21),
            ("comments", "a" * 501),
        ):
            with self.subTest(field=field):
                response = self.post(**{field: value})

                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.json())

        self.assertEqual(VolunteerSignup.objects.count(), 0)
        self.mock_send_email.assert_not_called()

    def test_fields_exactly_at_their_limit_are_accepted(self):
        response = self.post(
            first_name="a" * 100,
            last_name="b" * 100,
            phone="9" * 20,
            comments="c" * 500,
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(VolunteerSignup.objects.count(), 1)

    def test_japanese_and_punctuated_names_are_accepted(self):
        for first_name, last_name in (("太郎", "山田"), ("Mary-Jane", "O'Neil")):
            with self.subTest(first_name=first_name):
                cache.clear()
                response = self.post(first_name=first_name, last_name=last_name)

                self.assertEqual(response.status_code, 201)

    def test_whitespace_only_honeypot_value_is_treated_as_empty(self):
        response = self.post(website="   ")

        self.assertEqual(response.status_code, 201)
        signup = VolunteerSignup.objects.get()
        self.mock_send_email.assert_called_once_with(signup)

    # Throttling

    def test_limit_is_per_ip_address(self):
        with patch.dict(AnonRateThrottle.THROTTLE_RATES, {"volunteer_signup": "1/hour"}):
            first = self.client.post(
                SIGNUP_URL, self.payload, format="json", REMOTE_ADDR="10.0.0.1"
            )
            second = self.client.post(
                SIGNUP_URL, self.payload, format="json", REMOTE_ADDR="10.0.0.1"
            )
            other_ip = self.client.post(
                SIGNUP_URL,
                {**self.payload, "email": "other@example.com"},
                format="json",
                REMOTE_ADDR="10.0.0.2",
            )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 429)
        self.assertEqual(other_ip.status_code, 201)

    def test_signed_in_admin_is_not_throttled(self):
        admin = User.objects.create_user(
            email="admin@example.com",
            password="TestPass123!",
            first_name="Admin",
            last_name="User",
        )
        self.client.force_authenticate(user=admin)

        with patch.dict(AnonRateThrottle.THROTTLE_RATES, {"volunteer_signup": "2/hour"}):
            responses = [self.post() for _ in range(4)]

        self.assertEqual([response.status_code for response in responses], [201] * 4)

    def test_only_creating_a_signup_is_limited(self):
        with patch.dict(AnonRateThrottle.THROTTLE_RATES, {"volunteer_signup": "1/hour"}):
            created = self.post()
            refused = self.post()
            listing = self.client.get(SIGNUP_URL)
            deleted = self.client.delete(
                f"{SIGNUP_URL}{created.json()['volunteer_signup_id']}/"
            )

        self.assertEqual(created.status_code, 201)
        self.assertEqual(refused.status_code, 429)
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(deleted.status_code, 204)

    def test_honeypot_requests_count_toward_the_limit(self):
        with patch.dict(AnonRateThrottle.THROTTLE_RATES, {"volunteer_signup": "1/hour"}):
            bot = self.post(website="https://spam.example")
            real = self.post()

        self.assertEqual(bot.status_code, 201)
        self.assertEqual(real.status_code, 429)
        self.assertEqual(VolunteerSignup.objects.count(), 0)
        self.mock_send_email.assert_not_called()
