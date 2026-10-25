from django.core.management.base import BaseCommand
from django.db import transaction

from page.models import Page

PAGE_DEFAULTS = (
    ("home", "Home"),
    ("events", "Program|Events"),
    ("support", "Support"),
    ("membership", "Membership"),
    ("about", "About|Board"),
    ("partners", "Partners"),
)


class Command(BaseCommand):
    """Create the page records required by the page editor and public pages."""

    help = "Create any missing page records used by the page editor."

    @transaction.atomic
    def handle(self, *args, **options):
        """Create missing pages without changing existing page records."""
        created_count = 0

        for page_slug, page_title_en in PAGE_DEFAULTS:
            _, created = Page.objects.get_or_create(
                page_slug=page_slug,
                defaults={
                    "page_title_en": page_title_en,
                    "page_title_ja": "",
                },
            )
            if created:
                created_count += 1
                self.stdout.write(f"Created page: {page_title_en} ({page_slug})")
            else:
                self.stdout.write(f"Page already exists: {page_slug}")

        existing_count = len(PAGE_DEFAULTS) - created_count
        self.stdout.write(
            self.style.SUCCESS(
                f"Page seed complete. Created: {created_count}; existing: {existing_count}."
            )
        )
