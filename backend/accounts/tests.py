from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

VERIFY_URL = "/api/auth/token/verify/"
CSRF_URL = "/api/auth/csrf/"
LOGIN_URL = "/api/auth/login/"
REFRESH_URL = "/api/auth/token/refresh/"
LOGOUT_URL = "/api/auth/logout/"


class TokenVerifyTests(TestCase):
    """Verify access-token validation behavior."""

    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            email="verify@test.com", password="pass12345"  # adjust to your user model's fields
        )

    def test_valid_access_token_returns_200(self):
        token = str(RefreshToken.for_user(self.user).access_token)
        res = self.client.post(VERIFY_URL, {"token": token}, format="json")
        self.assertEqual(res.status_code, 200)

    def test_garbage_token_returns_401(self):
        res = self.client.post(VERIFY_URL, {"token": "not.a.jwt"}, format="json")
        self.assertEqual(res.status_code, 401)

    def test_tampered_token_returns_401(self):
        token = str(RefreshToken.for_user(self.user).access_token)
        h, p, s = token.split(".")
        bad = ".".join([h, p, ("A" if s[0] != "A" else "B") + s[1:]])
        res = self.client.post(VERIFY_URL, {"token": bad}, format="json")
        self.assertEqual(res.status_code, 401)


class RefreshCookieAuthenticationTests(TestCase):
    """Exercise the cookie-based refresh-token lifecycle."""

    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)
        self.user = get_user_model().objects.create_user(
            email="admin@example.com",
            password="pass12345",
            first_name="Admin",
            last_name="User",
        )

    def csrf_headers(self):
        """Get a CSRF token for requests that submit the refresh cookie."""
        response = self.client.get(CSRF_URL)
        self.assertEqual(response.status_code, 200)
        return {"HTTP_X_CSRFTOKEN": response.data["csrf_token"]}

    def login(self):
        """Log in with CSRF protection and return the response."""
        return self.client.post(
            LOGIN_URL,
            {"email": self.user.email, "password": "pass12345"},
            format="json",
            **self.csrf_headers(),
        )

    def test_login_sets_httponly_refresh_cookie_and_omits_refresh_body(self):
        response = self.login()

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertNotIn("refresh", response.data)
        cookie = response.cookies["msscc_refresh_token"]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["path"], "/api/auth/")

    def test_refresh_rotates_cookie_and_blacklists_previous_token(self):
        login_response = self.login()
        original_refresh_token = login_response.cookies["msscc_refresh_token"].value

        refresh_response = self.client.post(REFRESH_URL, **self.csrf_headers())

        self.assertEqual(refresh_response.status_code, 200)
        self.assertIn("access", refresh_response.data)
        self.assertNotIn("refresh", refresh_response.data)
        self.assertNotEqual(
            original_refresh_token,
            refresh_response.cookies["msscc_refresh_token"].value,
        )
        self.assertTrue(BlacklistedToken.objects.exists())

    def test_blacklisted_refresh_token_cannot_be_reused(self):
        login_response = self.login()
        original_refresh_token = login_response.cookies["msscc_refresh_token"].value
        self.client.post(REFRESH_URL, **self.csrf_headers())

        with self.assertRaises(TokenError):
            RefreshToken(original_refresh_token)

    def test_logout_blacklists_and_clears_refresh_cookie(self):
        login_response = self.login()
        original_refresh_token = login_response.cookies["msscc_refresh_token"].value

        response = self.client.post(LOGOUT_URL, **self.csrf_headers())

        self.assertEqual(response.status_code, 204)
        self.assertEqual(response.cookies["msscc_refresh_token"]["max-age"], 0)
        with self.assertRaises(TokenError):
            RefreshToken(original_refresh_token)

    def test_refresh_requires_csrf_token(self):
        self.login()

        response = self.client.post(REFRESH_URL)

        self.assertEqual(response.status_code, 403)


class AdminManagementPermissionTests(TestCase):
    """Ensure only appropriately privileged admins manage admin accounts."""

    def setUp(self):
        self.client = APIClient()
        self.regular_admin = get_user_model().objects.create_user(
            email="regular@example.com",
            password="pass12345",
        )
        self.executive_admin = get_user_model().objects.create_user(
            email="executive@example.com",
            password="pass12345",
            is_executive=True,
        )
        self.superuser = get_user_model().objects.create_superuser(
            email="developer@example.com",
            password="pass12345",
        )
        self.target_admin = get_user_model().objects.create_user(
            email="target@example.com",
            password="pass12345",
        )

    def test_anonymous_user_cannot_list_or_change_admin_permissions(self):
        self.assertEqual(self.client.get("/api/admins/").status_code, 401)
        self.assertEqual(
            self.client.patch(
                f"/api/admins/{self.target_admin.pk}/permissions/",
                {"permissions": {"Finances": True}},
                format="json",
            ).status_code,
            401,
        )

    def test_regular_admin_cannot_manage_admin_accounts(self):
        self.client.force_authenticate(user=self.regular_admin)

        self.assertEqual(self.client.get("/api/admins/").status_code, 403)
        self.assertEqual(
            self.client.patch(
                f"/api/admins/{self.target_admin.pk}/permissions/",
                {"permissions": {"Finances": True}},
                format="json",
            ).status_code,
            403,
        )

    def test_executive_admin_can_update_regular_admin_permissions(self):
        self.client.force_authenticate(user=self.executive_admin)

        response = self.client.patch(
            f"/api/admins/{self.target_admin.pk}/permissions/",
            {"permissions": {"Finances": True}},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.target_admin.refresh_from_db()
        self.assertEqual(self.target_admin.permissions_data, {"Finances": True})

    def test_executive_admin_cannot_change_executive_status(self):
        self.client.force_authenticate(user=self.executive_admin)

        response = self.client.patch(
            f"/api/admins/promote-executive/{self.target_admin.pk}",
            {"is_executive": True},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_superuser_can_change_executive_status(self):
        self.client.force_authenticate(user=self.superuser)

        response = self.client.patch(
            f"/api/admins/promote-executive/{self.target_admin.pk}",
            {"is_executive": True},
            format="json",
        )

        self.assertEqual(response.status_code, 204)
        self.target_admin.refresh_from_db()
        self.assertTrue(self.target_admin.is_executive)
