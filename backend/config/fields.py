from django.db import models

from config.encryption import decrypt_text, encrypt_text


class EncryptedTextField(models.TextField):
    """Store authenticated ciphertext while exposing plaintext Python values."""

    def get_prep_value(self, value):
        """Encrypt each supplied value, including an explicitly empty string."""
        return encrypt_text(super().get_prep_value(value))

    def from_db_value(self, value, expression, connection):
        """Decrypt stored values without accepting a plaintext fallback."""
        return decrypt_text(value)
