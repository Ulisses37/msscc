from importlib import import_module

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from emails.providers.base import EmailProvider, ProviderError

# Provider name -> dotted path of the adapter class. Adding a provider means
# adding an entry here and setting EMAIL_PROVIDER; no caller changes.
_PROVIDER_PATHS = {
    "resend": "emails.providers.resend.ResendProvider",
}


def get_provider() -> EmailProvider:
    """Return the configured email provider adapter.

    Concrete adapters are imported lazily so that an unused provider's SDK is
    never imported. Resend's SDK may only be imported by its own adapter module,
    which is why this indirection exists instead of importing one directly.
    """
    name = getattr(settings, "EMAIL_PROVIDER", "resend")
    path = _PROVIDER_PATHS.get(name)
    if path is None:
        raise ImproperlyConfigured(
            f"Unsupported EMAIL_PROVIDER value: {name!r}. "
            f"Supported values: {', '.join(sorted(_PROVIDER_PATHS))}."
        )

    module_path, class_name = path.rsplit(".", 1)
    return getattr(import_module(module_path), class_name)()


__all__ = ["EmailProvider", "ProviderError", "get_provider"]
