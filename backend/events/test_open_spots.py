from datetime import UTC, datetime

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from events.models import Event, VolunteerSignup, VolunteerSlot


class EventOpenSpotsTests(TestCase):
    """The event API reports spots still open across all of its shifts."""

    def setUp(self):
        self.client = APIClient()
        self.event = self.make_event()
        self.signup_count = 0

    def make_event(self, title: str = "Cultural Exchange") -> Event:
        """Create an event with a consistent time range for each test."""
        return Event.objects.create(
            title_en=title,
            title_ja=title,
            start_datetime=datetime(2026, 12, 25, 10, 0, tzinfo=UTC),
            end_datetime=datetime(2026, 12, 25, 12, 0, tzinfo=UTC),
        )

    def make_slot(self, capacity: int, event: Event | None = None) -> VolunteerSlot:
        """Create a shift for the selected event."""
        return VolunteerSlot.objects.create(
            event=event or self.event,
            position_name="Greeter",
            start_datetime=datetime(2026, 12, 25, 10, 0, tzinfo=UTC),
            end_datetime=datetime(2026, 12, 25, 12, 0, tzinfo=UTC),
            capacity=capacity,
        )

    def sign_up(self, slot: VolunteerSlot) -> VolunteerSignup:
        """Create an approved signup and give it a unique email address."""
        self.signup_count += 1
        return VolunteerSignup.objects.create(
            slot=slot,
            first_name="Aiko",
            last_name="Tanaka",
            email=f"volunteer{self.signup_count}@example.com",
            phone="9165550100",
            status="approved",
        )

    def open_spots(self) -> int:
        """Retrieve the current event's open volunteer capacity."""
        response = self.client.get(f"/api/events/{self.event.event_id}/")
        self.assertEqual(response.status_code, 200)
        return response.json()["open_spots"]

    def test_open_spots_is_capacity_minus_signups_across_shifts(self):
        """Add each shift's remaining capacity to produce the event total."""
        first = self.make_slot(3)
        self.make_slot(2)
        self.sign_up(first)
        self.sign_up(first)

        self.assertEqual(self.open_spots(), 3)

    def test_full_and_over_capacity_shifts_count_as_zero_not_negative(self):
        """Do not let over-capacity administrative signups create negative totals."""
        crowded = self.make_slot(1)
        self.make_slot(2)
        self.sign_up(crowded)
        self.sign_up(crowded)

        self.assertEqual(self.open_spots(), 2)

    def test_cancelling_a_signup_frees_its_spot(self):
        """Deleting an approved signup returns its place to the event total."""
        slot = self.make_slot(1)
        signup = self.sign_up(slot)
        self.assertEqual(self.open_spots(), 0)

        signup.delete()

        self.assertEqual(self.open_spots(), 1)

    def test_event_without_shifts_has_no_open_spots(self):
        """An event without shifts has no available volunteer capacity."""
        self.assertEqual(self.open_spots(), 0)

    def test_list_includes_open_spots_without_a_query_per_event(self):
        """Prefetch shifts so adding events does not add serializer queries."""
        self.make_slot(2)
        with CaptureQueriesContext(connection) as one_event:
            response = self.client.get("/api/events/")
        self.assertEqual(response.status_code, 200)

        for index in range(3):
            self.make_slot(2, event=self.make_event(f"Event {index}"))
        with CaptureQueriesContext(connection) as four_events:
            response = self.client.get("/api/events/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(four_events), len(one_event))
        self.assertTrue(all(row["open_spots"] == 2 for row in response.json()))
