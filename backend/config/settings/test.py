import os

os.environ["DJANGO_SECRET_KEY"] = "test-secret-key-for-pytest-only"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_dummy"
os.environ["S3_ENDPOINT_URL"] = "http://127.0.0.1:1"
os.environ["S3_ACCESS_KEY"] = "test"
os.environ["S3_SECRET_KEY"] = "test"
os.environ["RESEND_API_KEY"] = "re_test_dummy"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test_dummy"

from .base import *  # noqa: E402, F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

EMAIL_BACKEND = "django.core.mail.backends.dummy.EmailBackend"

STORAGES["staticfiles"] = {  # noqa: F405
    "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
}
