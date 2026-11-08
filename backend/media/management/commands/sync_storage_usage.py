from django.core.management.base import BaseCommand, CommandError

from media.storage_usage import StorageUsageSyncError, reconcile_storage_usage


class Command(BaseCommand):
    help = "Reconcile database storage usage with the configured object-storage bucket."

    def handle(self, *args, **options):
        try:
            snapshot = reconcile_storage_usage(raise_on_error=True)
        except StorageUsageSyncError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(
            self.style.SUCCESS(
                "Storage usage synchronized: "
                f"{snapshot.object_count} objects, {snapshot.used_bytes} bytes."
            )
        )
