from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from site_analytics.models import StorageUsageSnapshot


class Command(BaseCommand):
    help = "Synchronize the configured application storage quota into the database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show the configured quota without changing the database.",
        )

    def handle(self, *args, **options):
        configured_capacity = getattr(settings, "STORAGE_CAPACITY_BYTES", None)
        if not isinstance(configured_capacity, int) or configured_capacity <= 0:
            raise CommandError("STORAGE_CAPACITY_BYTES must be a positive integer.")

        snapshot = StorageUsageSnapshot.objects.filter(pk=1).first()
        previous_capacity = snapshot.capacity_bytes if snapshot else None

        if options["dry_run"]:
            self.stdout.write(
                "Dry run: "
                f"quota would change from {previous_capacity} to {configured_capacity} bytes."
            )
            return

        if snapshot is None:
            snapshot = StorageUsageSnapshot.objects.create(
                pk=1,
                capacity_bytes=configured_capacity,
            )
        else:
            snapshot.capacity_bytes = configured_capacity
            snapshot.save(update_fields=["capacity_bytes"])

        self.stdout.write(
            self.style.SUCCESS(
                f"Storage quota synchronized: {previous_capacity} -> "
                f"{snapshot.capacity_bytes} bytes."
            )
        )
