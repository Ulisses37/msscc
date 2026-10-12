from abc import ABC, abstractmethod
from enum import StrEnum


class ProviderError(Exception):
    """Raised by an email provider adapter when an operation fails.

    Callers log this and continue: a mailing-list signup must succeed in our
    database even when the provider is unavailable, because the database is the
    source of truth and the provider is only a mirror.
    """


class ContactState(StrEnum):
    """What ``upsert_contact`` found, so the caller can record consent locally.

    Values intentionally match ``Subscriber.Status`` so the service can store
    them without a mapping table.
    """

    SUBSCRIBED = "subscribed"
    UNSUBSCRIBED = "unsubscribed"


class EmailProvider(ABC):
    """Provider-agnostic interface for everything we ask an email service to do.

    Resend is the only implementation today. Keeping provider-specific behavior
    behind this interface means swapping providers needs a new adapter and an
    ``EMAIL_PROVIDER`` value, not changes to any calling code.
    """

    @abstractmethod
    def send_email(self, *, to: str, subject: str, html: str) -> None:
        """Send one transactional email to a single recipient."""

    @property
    @abstractmethod
    def unsubscribe_url(self) -> str:
        """Return a string a template can put in an ``href`` attribute.

        The provider replaces it with a working, per-recipient unsubscribe link
        when a broadcast is sent. Views read this instead of importing a
        provider-specific constant, so the calling code stays provider agnostic.
        """

    @abstractmethod
    def upsert_contact(self, email: str) -> ContactState:
        """Create or refresh a mailing-list contact. Idempotent.

        Returns the provider's view of the contact. An existing provider-side
        opt-out is reported rather than overridden, because the provider may
        hold an unsubscribe our database does not know about.
        """

    @abstractmethod
    def remove_contact(self, email: str) -> None:
        """Stop sending broadcasts to a contact. Idempotent."""

    @abstractmethod
    def send_broadcast(self, *, subject: str, html: str) -> None:
        """Send a marketing email to every contact in the configured segment."""
