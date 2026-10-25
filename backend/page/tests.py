from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from page.management.commands.seed_pages import PAGE_DEFAULTS
from page.models import Page


class SeedPagesCommandTests(TestCase):
    """Tests for creating the page records required by the page editor."""

    def test_command_creates_required_pages(self):
        """The command creates every page with the expected slug and English title."""
        call_command("seed_pages", stdout=StringIO())

        self.assertEqual(Page.objects.count(), len(PAGE_DEFAULTS))
        self.assertEqual(
            list(Page.objects.values_list("page_slug", "page_title_en")),
            list(PAGE_DEFAULTS),
        )
        self.assertFalse(Page.objects.exclude(page_title_ja="").exists())

    def test_command_is_idempotent(self):
        """Running the command repeatedly does not create duplicate pages."""
        call_command("seed_pages", stdout=StringIO())
        call_command("seed_pages", stdout=StringIO())

        self.assertEqual(Page.objects.count(), len(PAGE_DEFAULTS))

    def test_command_preserves_existing_page_values(self):
        """An existing page is not overwritten when the remaining pages are seeded."""
        Page.objects.create(
            page_slug="home",
            page_title_en="Existing Home Title",
            page_title_ja="既存のホームタイトル",
        )

        call_command("seed_pages", stdout=StringIO())

        home_page = Page.objects.get(page_slug="home")
        self.assertEqual(home_page.page_title_en, "Existing Home Title")
        self.assertEqual(home_page.page_title_ja, "既存のホームタイトル")
        self.assertEqual(Page.objects.count(), len(PAGE_DEFAULTS))
