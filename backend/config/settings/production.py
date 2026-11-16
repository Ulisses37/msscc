import os

import dj_database_url
from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403

DEBUG = False


def required_env(name: str) -> str:
    """Require hosted configuration without exposing its value."""
    value = os.environ.get(name, "").strip()
    if not value:
        raise ImproperlyConfigured(f"{name} is required for hosted deployment.")
    return value


# Railway supplies a private PostgreSQL URL through a service reference.
DATABASES = {"default": dj_database_url.parse(required_env("DATABASE_URL"), conn_max_age=60)}
if DATABASES["default"]["ENGINE"] != "django.db.backends.postgresql":
    raise ImproperlyConfigured("Hosted deployment requires a PostgreSQL DATABASE_URL.")

ALLOWED_HOSTS = [host.strip() for host in required_env("DJANGO_ALLOWED_HOSTS").split(",")]
ALLOWED_HOSTS.append("healthcheck.railway.app")
CORS_ALLOWED_ORIGINS = [
    origin.strip() for origin in required_env("CORS_ALLOWED_ORIGINS").split(",")
]
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS
FRONTEND_URL = required_env("FRONTEND_URL").rstrip("/")

# Railway terminates TLS before forwarding requests to Gunicorn.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SECURE_REDIRECT_EXEMPT = [r"^health/$"]
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
JWT_REFRESH_COOKIE_SECURE = True

# The hosted backend serves JSON; the Next.js portal replaces Django admin.
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
}

# R2 uses bucket access policies rather than S3 object ACLs.
AWS_DEFAULT_ACL = None
AWS_S3_CUSTOM_DOMAIN = required_env("S3_PUBLIC_DOMAIN")
for _name in ("S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_BUCKET", "S3_ENDPOINT_URL"):
    required_env(_name)
