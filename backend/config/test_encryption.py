import inspect

from cryptography.fernet import Fernet, InvalidToken
from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, override_settings

from config.encryption import (
    ENCRYPTED_TEXT_ENVELOPE_PREFIX,
    EncryptedTextError,
    decrypt_text,
    encrypt_text,
    is_encrypted_text,
    parse_encryption_keyring,
    rotate_encrypted_text,
)

TEST_ACTIVE_KEY = "mCz0qNSJS2G3LzI4SXfTWaU0JwBkzY0lG9_29s1mHdA="
TEST_PREVIOUS_KEY = "0A4NzhCj0VYN-fJkbLjuGFJTloZ2A8kQneO__n5P0Xo="


class EncryptionTests(SimpleTestCase):
    """Tests for the versioned field-encryption component."""

    def test_encrypt_and_decrypt_round_trip(self):
        ciphertext = encrypt_text("Jane Example")

        self.assertTrue(ciphertext.startswith(ENCRYPTED_TEXT_ENVELOPE_PREFIX))
        self.assertEqual(decrypt_text(ciphertext), "Jane Example")

    def test_encrypting_identical_plaintext_produces_distinct_ciphertext(self):
        first_ciphertext = encrypt_text("member@example.test")
        second_ciphertext = encrypt_text("member@example.test")

        self.assertNotEqual(first_ciphertext, second_ciphertext)
        self.assertEqual(decrypt_text(first_ciphertext), "member@example.test")
        self.assertEqual(decrypt_text(second_ciphertext), "member@example.test")

    def test_unicode_and_punctuation_round_trip_without_data_loss(self):
        plaintext = "松山, O'Connor, 東京! ☕\n"

        self.assertEqual(decrypt_text(encrypt_text(plaintext)), plaintext)

    def test_blank_and_null_values_are_preserved(self):
        self.assertEqual(decrypt_text(encrypt_text("")), "")
        self.assertIsNone(encrypt_text(None))
        self.assertIsNone(decrypt_text(None))
        self.assertIsNone(rotate_encrypted_text(None))

    def test_is_encrypted_text_identifies_the_application_envelope(self):
        self.assertTrue(is_encrypted_text(encrypt_text("encrypted")))
        self.assertTrue(is_encrypted_text("msscc:enc:v2:future-format"))
        self.assertFalse(is_encrypted_text("plaintext"))
        self.assertFalse(is_encrypted_text(None))

    def test_plaintext_and_malformed_ciphertext_raise_controlled_errors(self):
        for value in ("plaintext", "msscc:enc:v1:", "msscc:enc:v2:token"):
            with self.subTest(value=value):
                with self.assertRaisesRegex(
                    EncryptedTextError,
                    "Encrypted text is invalid or cannot be decrypted.",
                ):
                    decrypt_text(value)

    def test_tampered_ciphertext_raises_controlled_error_without_disclosure(self):
        plaintext = "private@example.test"
        ciphertext = encrypt_text(plaintext)
        tampered_ciphertext = f"{ciphertext[:-1]}A"

        with self.assertRaises(EncryptedTextError) as captured:
            decrypt_text(tampered_ciphertext)

        self.assertNotIn(plaintext, str(captured.exception))
        self.assertNotIn(tampered_ciphertext, str(captured.exception))

    def test_decrypts_with_a_previous_key(self):
        previous_ciphertext = Fernet(TEST_PREVIOUS_KEY.encode("ascii")).encrypt(
            b"member@example.test"
        ).decode("ascii")
        envelope = f"{ENCRYPTED_TEXT_ENVELOPE_PREFIX}{previous_ciphertext}"

        with override_settings(FIELD_ENCRYPTION_KEYS=(TEST_ACTIVE_KEY, TEST_PREVIOUS_KEY)):
            self.assertEqual(decrypt_text(envelope), "member@example.test")

    def test_rotation_reencrypts_with_the_active_key(self):
        previous_fernet = Fernet(TEST_PREVIOUS_KEY.encode("ascii"))
        previous_ciphertext = previous_fernet.encrypt(b"member@example.test").decode("ascii")
        envelope = f"{ENCRYPTED_TEXT_ENVELOPE_PREFIX}{previous_ciphertext}"

        with override_settings(FIELD_ENCRYPTION_KEYS=(TEST_ACTIVE_KEY, TEST_PREVIOUS_KEY)):
            rotated = rotate_encrypted_text(envelope)
            self.assertEqual(decrypt_text(rotated), "member@example.test")

        active_token = rotated.removeprefix(ENCRYPTED_TEXT_ENVELOPE_PREFIX)
        Fernet(TEST_ACTIVE_KEY.encode("ascii")).decrypt(active_token.encode("ascii"))
        with self.assertRaises(InvalidToken):
            previous_fernet.decrypt(active_token.encode("ascii"))

    def test_invalid_keyring_configuration_raises_controlled_errors(self):
        invalid_values = (
            None,
            "",
            " , ",
            f"{TEST_ACTIVE_KEY},",
            f"{TEST_ACTIVE_KEY},{TEST_ACTIVE_KEY}",
            "not-a-fernet-key",
        )

        for value in invalid_values:
            with self.subTest(value=value):
                with self.assertRaises(ImproperlyConfigured) as captured:
                    parse_encryption_keyring(value)

                self.assertNotIn("not-a-fernet-key", str(captured.exception))

    def test_invalid_overridden_setting_raises_controlled_configuration_error(self):
        with override_settings(FIELD_ENCRYPTION_KEYS=("not-a-fernet-key",)):
            with self.assertRaises(ImproperlyConfigured) as captured:
                encrypt_text("private@example.test")

        self.assertNotIn("private@example.test", str(captured.exception))
        self.assertNotIn("not-a-fernet-key", str(captured.exception))

    def test_component_does_not_write_sensitive_values_to_logs(self):
        import config.encryption

        source = inspect.getsource(config.encryption)

        self.assertNotIn("logging", source)
        self.assertNotIn("logger", source)
