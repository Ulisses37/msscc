from abc import ABC, abstractmethod


class ProviderError(Exception):
    """Raised by an email provider adapter when an operation fails.

    Callers log this and continue: a mailing-list signup must succeed in our
    database even when the provider is unavailable, because the database is the
    source of truth and the provider is only a mirror.
    """


class EmailProvider(ABC):
    """Provider-agnostic interface for everything we ask an email service to do.

    Resend is the only implementation today. Keeping provider-specific behavior
    behind this interface means swapping providers needs a new adapter and an
    ``EMAIL_PROVIDER`` value, not changes to any calling code.
    """

    @abstractmethod
    def send_email(self, *, to: str, subject: str, html: str) -> None:
        """Send one transactional email to a single recipient."""

    @abstractmethod
    def upsert_contact(self, email: str) -> None:
        """Create or refresh a mailing-list contact. Idempotent."""

    @abstractmethod
    def remove_contact(self, email: str) -> None:
        """Stop sending broadcasts to a contact. Idempotent."""

    @abstractmethod
    def send_broadcast(self, *, subject: str, html: str) -> None:
        """Send a marketing email to every contact in the configured segment."""
