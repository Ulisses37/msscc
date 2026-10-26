from datetime import date
from unittest.mock import patch

from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APIClient

from .models import DailyVisit

FIXED_TODAY = date(2026, 10, 25)


def freeze_today():
    """Make the views think today is FIXED_TODAY."""
    return patch("site_analytics.views.timezone.localdate", return_value=FIXED_TODAY)


class TrackVisitTests(TestCase):
    def setUp(self):
        cache.clear()  # the anon throttle stores counts in the cache
        self.client = APIClient()

    def test_first_visit_creates_row(self):
        with freeze_today():
            res = self.client.post("/api/visits/")
        self.assertEqual(res.status_code, 204)
        self.assertEqual(DailyVisit.objects.get(date=FIXED_TODAY).count, 1)

    def test_repeat_visits_increment_same_row(self):
        with freeze_today():
            for _ in range(3):
                self.client.post("/api/visits/")
        self.assertEqual(DailyVisit.objects.count(), 1)
        self.assertEqual(DailyVisit.objects.get().count, 3)

    def test_new_day_creates_new_row(self):
        DailyVisit.objects.create(date=date(2026, 10, 24), count=9)
        with freeze_today():
            self.client.post("/api/visits/")
        self.assertEqual(DailyVisit.objects.count(), 2)
        self.assertEqual(DailyVisit.objects.get(date=date(2026, 10, 24)).count, 9)

    def test_get_not_allowed(self):
        res = self.client.get("/api/visits/")
        self.assertEqual(res.status_code, 405)


class StatsViewTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def test_summary_empty_table_returns_zeros(self):
        with freeze_today():
            res = self.client.get("/api/visits/summary/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["today"], 0)
        self.assertEqual(res.data["this_month"], 0)
        self.assertEqual(res.data["this_year"], 0)
        self.assertEqual(res.data["all_time"], 0)

    def test_summary_windows(self):
        DailyVisit.objects.create(date=date(2026, 10, 25), count=5)    # today
        DailyVisit.objects.create(date=date(2026, 10, 1), count=10)    # this month
        DailyVisit.objects.create(date=date(2026, 1, 1), count=20)     # this year
        DailyVisit.objects.create(date=date(2025, 12, 31), count=100)  # last year
        with freeze_today():
            res = self.client.get("/api/visits/summary/")
        self.assertEqual(res.data["today"], 5)
        self.assertEqual(res.data["this_month"], 15)
        self.assertEqual(res.data["this_year"], 35)
        self.assertEqual(res.data["all_time"], 135)
        self.assertEqual(res.data["year"], 2026)
        self.assertEqual(res.data["month"], 10)

    def test_yearly_stats_shape_and_sums(self):
        DailyVisit.objects.create(date=date(2026, 1, 15), count=3)
        DailyVisit.objects.create(date=date(2026, 1, 20), count=4)
        DailyVisit.objects.create(date=date(2026, 10, 25), count=5)
        DailyVisit.objects.create(date=date(2025, 1, 1), count=99)  # other year, ignored
        res = self.client.get("/api/visits/2026/")
        views = res.data["yearly_views"]
        self.assertEqual(len(views), 13)
        self.assertEqual(views[0], 2026)
        self.assertEqual(views[1], 7)
        self.assertEqual(views[10], 5)
        self.assertEqual(sum(views[1:]), 12)


class DailyVisitModelTests(TestCase):
    def test_date_is_unique(self):
        DailyVisit.objects.create(date=FIXED_TODAY)
        with self.assertRaises(IntegrityError), transaction.atomic():
            DailyVisit.objects.create(date=FIXED_TODAY)

    def test_str(self):
        self.assertEqual(
            str(DailyVisit(date=FIXED_TODAY, count=7)), "2026-10-25: 7"
        )
