from collections.abc import Sequence

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

ENCRYPTED_TEXT_PREFIX = "msscc:enc:"
ENCRYPTED_TEXT_VERSION = "v1"
ENCRYPTED_TEXT_ENVELOPE_PREFIX = f"{ENCRYPTED_TEXT_PREFIX}{ENCRYPTED_TEXT_VERSION}:"


class EncryptedTextError(ValueError):
    """Raised when encrypted text is malformed, unsupported, or cannot be decrypted."""


def parse_encryption_keyring(raw_value: str | None) -> tuple[str, ...]:
    """Validate a comma-separated Fernet keyring without exposing its values."""
    if raw_value is None or not raw_value.strip():
        raise ImproperlyConfigured("FIELD_ENCRYPTION_KEYS must contain at least one Fernet key.")

    keys = tuple(key.strip() for key in raw_value.split(","))
    if not all(keys):
        raise ImproperlyConfigured("FIELD_ENCRYPTION_KEYS must not contain blank key entries.")
    if len(set(keys)) != len(keys):
        raise ImproperlyConfigured("FIELD_ENCRYPTION_KEYS must not contain duplicate keys.")

    try:
        for key in keys:
            Fernet(key.encode("ascii"))
    except (UnicodeEncodeError, ValueError) as exc:
        raise ImproperlyConfigured(
            "FIELD_ENCRYPTION_KEYS must contain valid URL-safe base64 Fernet keys."
        ) from exc

    return keys


def is_encrypted_text(value: object) -> bool:
    """Return whether a value uses the application encrypted-text envelope."""
    return isinstance(value, str) and value.startswith(ENCRYPTED_TEXT_PREFIX)


def encrypt_text(value: str | None) -> str | None:
    """Encrypt text with the active key while preserving null values."""
    if value is None:
        return None
    if not isinstance(value, str):
        raise TypeError("Encrypted text values must be strings or None.")

    token = _get_fernet().encrypt(value.encode("utf-8")).decode("ascii")
    return f"{ENCRYPTED_TEXT_ENVELOPE_PREFIX}{token}"


def decrypt_text(value: str | None) -> str | None:
    """Decrypt a versioned application ciphertext without returning plaintext on failure."""
    if value is None:
        return None
    if not isinstance(value, str):
        raise EncryptedTextError("Encrypted text is invalid or cannot be decrypted.")

    token = _extract_token(value)
    try:
        return _get_fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, UnicodeDecodeError, UnicodeEncodeError) as exc:
        raise EncryptedTextError("Encrypted text is invalid or cannot be decrypted.") from exc


def rotate_encrypted_text(value: str | None) -> str | None:
    """Re-encrypt a valid ciphertext with the active key while preserving null values."""
    if value is None:
        return None
    if not isinstance(value, str):
        raise EncryptedTextError("Encrypted text is invalid or cannot be decrypted.")

    token = _extract_token(value)
    try:
        rotated_token = _get_fernet().rotate(token.encode("ascii")).decode("ascii")
    except (InvalidToken, UnicodeDecodeError, UnicodeEncodeError) as exc:
        raise EncryptedTextError("Encrypted text is invalid or cannot be decrypted.") from exc

    return f"{ENCRYPTED_TEXT_ENVELOPE_PREFIX}{rotated_token}"


def _extract_token(value: str) -> str:
    """Extract a supported Fernet token without accepting plaintext fallback values."""
    if not value.startswith(ENCRYPTED_TEXT_ENVELOPE_PREFIX):
        raise EncryptedTextError("Encrypted text is invalid or cannot be decrypted.")

    token = value.removeprefix(ENCRYPTED_TEXT_ENVELOPE_PREFIX)
    if not token:
        raise EncryptedTextError("Encrypted text is invalid or cannot be decrypted.")
    return token


def _get_fernet() -> MultiFernet:
    """Build a MultiFernet instance from the validated ordered Django setting."""
    keyring = _validated_setting_keyring(settings.FIELD_ENCRYPTION_KEYS)
    return MultiFernet([Fernet(key.encode("ascii")) for key in keyring])


def _validated_setting_keyring(value: object) -> Sequence[str]:
    """Reject overridden or manually configured invalid keyring settings safely."""
    if not isinstance(value, (list, tuple)) or not all(isinstance(key, str) for key in value):
        raise ImproperlyConfigured("FIELD_ENCRYPTION_KEYS must be a validated ordered keyring.")

    return parse_encryption_keyring(",".join(value))
