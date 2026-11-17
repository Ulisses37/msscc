from importlib.util import module_from_spec, spec_from_file_location

from django.conf import settings
from django.test import TestCase, override_settings
from django.urls import NoReverseMatch, resolve, reverse

from config import urls


class AdminRouteTests(TestCase):
    """Keep the development-only Django admin separate from application APIs."""

    def load_urlconf(self):
        """Evaluate routing without mutating the shared URL configuration module."""
        spec = spec_from_file_location("config.admin_route_test_urls", urls.__file__)
        module = module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_builtin_admin_is_disabled_by_default(self):
        self.assertFalse(settings.DJANGO_ADMIN_ENABLED)

    @override_settings(DJANGO_ADMIN_ENABLED=False)
    def test_disabled_admin_paths_return_not_found(self):
        with override_settings(ROOT_URLCONF=self.load_urlconf()):
            for path in ("/admin", "/admin/", "/admin/login/", "/admin/accounts/adminuser/"):
                with self.subTest(path=path):
                    self.assertEqual(self.client.get(path).status_code, 404)

    @override_settings(DJANGO_ADMIN_ENABLED=False)
    def test_disabled_admin_has_no_url_namespace(self):
        with self.assertRaises(NoReverseMatch):
            reverse("admin:index", urlconf=self.load_urlconf())

    @override_settings(DJANGO_ADMIN_ENABLED=True)
    def test_enabled_admin_login_is_available(self):
        urlconf = self.load_urlconf()
        self.assertEqual(reverse("admin:index", urlconf=urlconf), "/admin/")
        with override_settings(ROOT_URLCONF=urlconf):
            self.assertEqual(self.client.get("/admin/login/").status_code, 200)

    @override_settings(DJANGO_ADMIN_ENABLED=False)
    def test_application_admin_api_routes_remain_available(self):
        urlconf = self.load_urlconf()
        for path in ("/api/auth/login/", "/api/admins/", "/api/admin/admin_support/"):
            with self.subTest(path=path):
                self.assertIsNotNone(resolve(path, urlconf=urlconf).func)
