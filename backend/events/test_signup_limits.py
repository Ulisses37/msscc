import threading
from datetime import UTC, datetime, timedelta
from unittest import skipUnless
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from django.test import TestCase, TransactionTestCase
from rest_framework.test import APIClient
from rest_framework.throttling import AnonRateThrottle

from events.models import Event, VolunteerSignup, VolunteerSlot

User = get_user_model()

SIGNUP_URL = "/api/events/signups/"
ADMIN_SIGNUP_URL = "/api/events/admin/signups/"


class SignupLimitsMixin:
    """Shared setup: no throttle in the way, no real email, and an upcoming event."""

    def setUp(self):
        super().setUp()
        cache.clear()
        self.addCleanup(cache.clear)

        # These tests are about duplicates and capacity, not the per-IP limit.
        rates = patch.dict(
            AnonRateThrottle.THROTTLE_RATES,
            {"volunteer_signup": "1000/hour"},
        )
        rates.start()
        self.addCleanup(rates.stop)

        mail = patch("events.views.send_volunteer_thanks_email")
        self.mock_send_email = mail.start()
        self.addCleanup(mail.stop)

        self.start = datetime.now(UTC) + timedelta(days=30)
        self.event = Event.objects.create(
            title_en="Cultural Exchange",
            title_ja="文化交流",
            start_datetime=self.start,
            end_datetime=self.start + timedelta(hours=2),
        )
        self.client = APIClient()
        self.email_count = 0
        self.admin_count = 0

    def make_slot(self, capacity=50, position_name="Greeter"):
        """Create a shift with the requested capacity and role."""
        return VolunteerSlot.objects.create(
            event=self.event,
            position_name=position_name,
            start_datetime=self.start,
            end_datetime=self.start + timedelta(hours=2),
            capacity=capacity,
        )

    def next_email(self):
        """Return a unique volunteer email address."""
        self.email_count += 1
        return f"volunteer{self.email_count}@example.com"

    def post(self, slot=None, **overrides):
        """Sign up publicly, using a fresh email unless the caller provides one."""
        payload = {
            "first_name": "Aiko",
            "last_name": "Tanaka",
            "email": self.next_email(),
            "phone": "916-555-0100",
        }
        if slot is not None:
            payload["slot_id"] = slot.volunteer_slot_id
        payload.update(overrides)
        return self.client.post(SIGNUP_URL, payload, format="json")

    def make_signup(self, slot, email=None):
        """Create an approved signup directly, skipping endpoint validation."""
        return VolunteerSignup.objects.create(
            slot=slot,
            first_name="Aiko",
            last_name="Tanaka",
            email=email or self.next_email(),
            phone="916-555-0100",
            status="approved",
        )

    def make_admin_client(self, permissions=None, executive=False):
        """Create an authenticated admin client with event-access overrides."""
        self.admin_count += 1
        extra = {"is_executive": executive}
        if permissions is not None:
            extra["permissions_data"] = permissions
        user = User.objects.create_user(
            email=f"admin{self.admin_count}@example.com",
            password="TestPass123!",
            first_name="Admin",
            last_name="User",
            **extra,
        )
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def admin_post(self, client, slot, **overrides):
        """Add a volunteer through the admin-only endpoint."""
        payload = {
            "slot": slot.pk,
            "first_name": "Admin",
            "last_name": "Added",
            "email": self.next_email(),
            "phone": "916-555-0100",
        }
        payload.update(overrides)
        return client.post(ADMIN_SIGNUP_URL, payload, format="json")


class DuplicateSignupTests(SignupLimitsMixin, TestCase):
    """The same email cannot sign up twice for the same shift."""

    def test_same_email_cannot_sign_up_twice_for_the_same_shift(self):
        slot = self.make_slot()

        first = self.post(slot, email="aiko@example.com")
        second = self.post(slot, email="aiko@example.com")

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 400)
        self.assertIn("email", second.json())
        self.assertEqual(second.json()["code"], ["duplicate_signup"])
        self.assertEqual(VolunteerSignup.objects.count(), 1)
        self.mock_send_email.assert_called_once()

    def test_match_ignores_capitalization_and_surrounding_spaces(self):
        slot = self.make_slot()
        self.post(slot, email="aiko@example.com")

        response = self.post(slot, email="  AIKO@Example.COM ")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(VolunteerSignup.objects.count(), 1)

    def test_same_email_can_sign_up_for_a_different_shift(self):
        first_slot = self.make_slot(position_name="Greeter")
        second_slot = self.make_slot(position_name="Setup")

        self.assertEqual(self.post(first_slot, email="aiko@example.com").status_code, 201)
        self.assertEqual(self.post(second_slot, email="aiko@example.com").status_code, 201)

    def test_a_different_email_can_sign_up_for_the_same_shift(self):
        slot = self.make_slot()

        self.assertEqual(self.post(slot).status_code, 201)
        self.assertEqual(self.post(slot).status_code, 201)

    def test_signups_without_a_shift_are_not_checked(self):
        self.assertEqual(self.post(email="aiko@example.com").status_code, 201)
        self.assertEqual(self.post(email="aiko@example.com").status_code, 201)
        self.mock_send_email.assert_not_called()

    def test_editing_a_signup_is_not_a_duplicate_of_itself(self):
        slot = self.make_slot()
        signup = self.make_signup(slot, email="aiko@example.com")

        response = self.make_admin_client(executive=True).patch(
            f"{SIGNUP_URL}{signup.volunteer_signup_id}/",
            {"email": "aiko@example.com", "phone": "916-555-0199"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)


class VolunteerSignupPermissionsTests(SignupLimitsMixin, TestCase):
    """Public signup creation stays open while signup management requires event access."""

    def assert_management_refused(self, client, signup, expected_status):
        """Assert every signup management action is refused without changing the signup."""
        url = f"{SIGNUP_URL}{signup.volunteer_signup_id}/"
        requests = {
            "list": lambda: client.get(f"{SIGNUP_URL}?slot_id={signup.slot_id}"),
            "retrieve": lambda: client.get(url),
            "patch": lambda: client.patch(url, {"first_name": "Changed"}, format="json"),
            "put": lambda: client.put(url, {"first_name": "Changed"}, format="json"),
            "delete": lambda: client.delete(url),
        }
        for action, send in requests.items():
            with self.subTest(action=action):
                self.assertEqual(send().status_code, expected_status)

        signup.refresh_from_db()
        self.assertEqual(signup.first_name, "Aiko")

    def test_public_signup_creation_does_not_require_authentication(self):
        slot = self.make_slot()

        response = self.post(slot)

        self.assertEqual(response.status_code, 201)

    def test_logged_out_requests_cannot_read_or_change_signups(self):
        signup = self.make_signup(self.make_slot())

        self.assert_management_refused(self.client, signup, 401)

    def test_an_admin_without_the_events_permission_cannot_manage_signups(self):
        signup = self.make_signup(self.make_slot())
        client = self.make_admin_client(permissions={"Events": False, "Finances": True})

        self.assert_management_refused(client, signup, 403)

    def test_an_admin_with_no_permissions_cannot_manage_signups(self):
        signup = self.make_signup(self.make_slot())
        client = self.make_admin_client(permissions={})

        self.assert_management_refused(client, signup, 403)

    def test_an_events_admin_can_view_edit_and_remove_signups(self):
        slot = self.make_slot()
        signup = self.make_signup(slot, email="aiko@example.com")
        client = self.make_admin_client(permissions={"Events": True})
        url = f"{SIGNUP_URL}{signup.volunteer_signup_id}/"

        listing = client.get(f"{SIGNUP_URL}?slot_id={slot.volunteer_slot_id}")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual([row["email"] for row in listing.json()], ["aiko@example.com"])
        self.assertEqual(client.get(url).status_code, 200)
        self.assertEqual(
            client.patch(url, {"first_name": "Mina"}, format="json").status_code,
            200,
        )
        self.assertEqual(client.delete(url).status_code, 204)
        self.assertFalse(VolunteerSignup.objects.filter(pk=signup.pk).exists())

    def test_an_executive_can_view_signups(self):
        slot = self.make_slot()
        self.make_signup(slot)

        response = self.make_admin_client(executive=True).get(
            f"{SIGNUP_URL}?slot_id={slot.volunteer_slot_id}"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)


class FullShiftTests(SignupLimitsMixin, TestCase):
    """The public endpoint refuses a signup once the shift is full."""

    def test_a_full_shift_is_refused_with_a_distinct_code(self):
        slot = self.make_slot(capacity=1)

        first = self.post(slot)
        second = self.post(slot)

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 400)
        self.assertEqual(second.json()["code"], ["shift_full"])
        self.assertEqual(VolunteerSignup.objects.filter(slot=slot).count(), 1)
        self.mock_send_email.assert_called_once()

    def test_the_last_spot_is_accepted_and_the_next_is_refused(self):
        slot = self.make_slot(capacity=2)

        self.assertEqual(self.post(slot).status_code, 201)
        self.assertEqual(self.post(slot).status_code, 201)
        self.assertEqual(self.post(slot).status_code, 400)

    def test_flags_in_the_request_body_do_not_override_capacity(self):
        slot = self.make_slot(capacity=1)
        self.post(slot)

        response = self.post(
            slot,
            allow_over_capacity=True,
            over_capacity=True,
            force=True,
            override=True,
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], ["shift_full"])
        self.assertEqual(VolunteerSignup.objects.filter(slot=slot).count(), 1)

    def test_signups_without_a_shift_ignore_capacity(self):
        self.make_slot(capacity=1)

        self.assertEqual(self.post().status_code, 201)
        self.assertEqual(self.post().status_code, 201)


class AdminSignupEndpointTests(SignupLimitsMixin, TestCase):
    """Only authorized admins can add a volunteer past a shift's capacity."""

    def test_a_logged_out_request_is_refused(self):
        slot = self.make_slot(capacity=1)

        response = self.client.post(
            ADMIN_SIGNUP_URL,
            {
                "slot": slot.pk,
                "first_name": "Admin",
                "last_name": "Added",
                "email": "admin-added@example.com",
                "phone": "916-555-0100",
            },
            format="json",
        )

        self.assertIn(response.status_code, (401, 403))
        self.assertEqual(VolunteerSignup.objects.count(), 0)

    def test_an_admin_without_the_events_permission_is_refused(self):
        slot = self.make_slot(capacity=1)
        client = self.make_admin_client(permissions={"Events": False, "Finances": True})

        response = self.admin_post(client, slot)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(VolunteerSignup.objects.count(), 0)

    def test_an_events_admin_can_add_past_capacity(self):
        slot = self.make_slot(capacity=1)
        self.post(slot)
        client = self.make_admin_client(permissions={"Events": True})

        response = self.admin_post(client, slot)

        self.assertEqual(response.status_code, 201)
        slot.refresh_from_db()
        self.assertEqual(slot.filled_count, 2)
        self.assertGreater(slot.filled_count, slot.capacity)

    def test_an_executive_can_add_past_capacity(self):
        slot = self.make_slot(capacity=1)
        self.post(slot)

        response = self.admin_post(self.make_admin_client(executive=True), slot)

        self.assertEqual(response.status_code, 201)

    def test_the_public_endpoint_still_refuses_after_an_admin_goes_over(self):
        slot = self.make_slot(capacity=1)
        self.post(slot)
        self.admin_post(self.make_admin_client(executive=True), slot)

        response = self.post(slot)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], ["shift_full"])

    def test_the_admin_endpoint_still_refuses_duplicates(self):
        slot = self.make_slot(capacity=1)
        client = self.make_admin_client(executive=True)
        self.admin_post(client, slot, email="aiko@example.com")

        response = self.admin_post(client, slot, email="AIKO@example.com")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], ["duplicate_signup"])


class SpotCountTests(SignupLimitsMixin, TestCase):
    """Removing or cancelling frees a spot, and editing a signup does not change it."""

    def test_removing_a_volunteer_frees_a_spot(self):
        slot = self.make_slot(capacity=1)
        created = self.post(slot)
        self.assertEqual(self.post(slot).status_code, 400)

        removed = self.make_admin_client(executive=True).delete(
            f"{SIGNUP_URL}{created.json()['volunteer_signup_id']}/"
        )

        self.assertEqual(removed.status_code, 204)
        self.assertEqual(self.post(slot).status_code, 201)

    def test_cancelling_by_link_frees_a_spot(self):
        slot = self.make_slot(capacity=1)
        signup = self.make_signup(slot)
        slot.refresh_from_db()
        self.assertEqual(slot.filled_count, 1)

        response = self.client.delete(f"{SIGNUP_URL}cancel/{signup.cancellation_token}/")

        self.assertEqual(response.status_code, 204)
        slot.refresh_from_db()
        self.assertEqual(slot.filled_count, 0)

    def test_removing_from_an_over_capacity_shift_keeps_it_full(self):
        slot = self.make_slot(capacity=1)
        first = self.make_signup(slot)
        self.make_signup(slot)
        slot.refresh_from_db()
        self.assertEqual(slot.filled_count, 2)

        response = self.make_admin_client(executive=True).delete(
            f"{SIGNUP_URL}{first.volunteer_signup_id}/"
        )

        self.assertEqual(response.status_code, 204)
        slot.refresh_from_db()
        self.assertEqual(slot.filled_count, 1)
        self.assertEqual(self.post(slot).status_code, 400)

    def test_editing_a_signup_does_not_change_the_count(self):
        slot = self.make_slot(capacity=2)
        signup = self.make_signup(slot)

        response = self.make_admin_client(executive=True).patch(
            f"{SIGNUP_URL}{signup.volunteer_signup_id}/",
            {"first_name": "Mina", "phone": "916-555-0199"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        slot.refresh_from_db()
        self.assertEqual(slot.filled_count, 1)


@skipUnless(connection.vendor == "postgresql", "needs a database that supports row locks")
class SimultaneousLastSpotTests(SignupLimitsMixin, TransactionTestCase):
    """Two requests for the last spot at the same moment create only one signup."""

    def test_two_requests_for_the_last_spot_create_one_signup(self):
        slot = self.make_slot(capacity=1)
        emails = [self.next_email(), self.next_email()]
        barrier = threading.Barrier(2)
        status_codes = []

        def submit(email):
            try:
                barrier.wait(timeout=10)
                response = APIClient().post(
                    SIGNUP_URL,
                    {
                        "slot_id": slot.volunteer_slot_id,
                        "first_name": "Aiko",
                        "last_name": "Tanaka",
                        "email": email,
                        "phone": "916-555-0100",
                    },
                    format="json",
                )
                status_codes.append(response.status_code)
            finally:
                connection.close()

        threads = [threading.Thread(target=submit, args=(email,)) for email in emails]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=30)

        self.assertEqual(sorted(status_codes), [201, 400])
        self.assertEqual(VolunteerSignup.objects.filter(slot=slot).count(), 1)
