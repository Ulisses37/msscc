from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from events.models import Event

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
