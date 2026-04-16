from .base import *
import os
import dj_database_url

DEBUG = True
ALLOWED_HOSTS = ['localhost', '127.0.0.1']

DATABASES = {
    "default": dj_database_url.parse(os.environ["DATABASE_URL"]),
}
